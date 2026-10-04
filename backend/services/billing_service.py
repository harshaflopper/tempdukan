import time
import re
from typing import Dict, Any, List, Optional
from db import get_supabase
from config import settings
from services.shop_memory_service import find_existing_product, update_product_stock, save_product_to_shop_memory
from services.sms_service import send_bill_sms, send_payment_received_sms, send_udhaar_reminder_sms

def normalize_customer_name(name: Optional[str]) -> str:
    if not name:
        return ""
    # Strip common Indian honorifics (ji, bhaiya, bhai, sir, kaka, uncle, saab, babu, seth, sethji)
    cleaned = re.sub(r'\b(ji|bhaiya|bhai|sir|kaka|uncle|saab|babu|seth|sethji)\b', '', name, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned if cleaned else name.strip()

async def get_or_create_customer(
    shop_id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Finds existing customer by mobile phone (priority cross-match) or name/normalized base name,
    preventing duplicate profiles when names vary (e.g. 'Ravi ji' vs 'Ravi').
    Auto-updates customer phone or name if provided.
    """
    supabase = get_supabase()
    if not supabase or (not name and not phone):
        return None

    raw_name = (name or "").strip()
    base_name = normalize_customer_name(raw_name)
    clean_phone = re.sub(r'\D', '', (phone or "").strip())

    try:
        # Step 1: SEARCH BY MOBILE PHONE FIRST (Primary unique identifier cross-match)
        if clean_phone:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).execute()
            if res.data:
                for cust in res.data:
                    c_phone = re.sub(r'\D', '', cust.get("phone") or "")
                    if c_phone and (c_phone == clean_phone or (len(clean_phone) >= 10 and c_phone.endswith(clean_phone[-10:]))):
                        # Phone cross-match successful!
                        if raw_name and (not cust.get("name") or cust.get("name").startswith("Customer-")):
                            supabase.table("customers").update({"name": base_name or raw_name}).eq("id", cust["id"]).execute()
                            cust["name"] = base_name or raw_name
                        return cust

        # Step 2: SEARCH BY NAME & NORMALIZED BASE NAME CROSS-MATCH
        if raw_name or base_name:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).execute()
            if res.data and len(res.data) > 0:
                existing_list = res.data

                # Priority A: Exact Name Match
                for cust in existing_list:
                    c_name = (cust.get("name") or "").strip().lower()
                    if c_name and (raw_name.lower() == c_name or (base_name and base_name.lower() == c_name)):
                        if clean_phone and not cust.get("phone"):
                            supabase.table("customers").update({"phone": clean_phone}).eq("id", cust["id"]).execute()
                            cust["phone"] = clean_phone
                        return cust

                # Priority B: Normalized Base Name Cross-Match (e.g. 'Ravi ji' matches 'Ravi' or 'Ravi Kumar')
                for cust in existing_list:
                    c_name = (cust.get("name") or "").strip().lower()
                    c_base = normalize_customer_name(c_name).lower()

                    if base_name and c_base and (
                        base_name.lower() == c_base or
                        base_name.lower() in c_name or
                        c_base in raw_name.lower()
                    ):
                        if clean_phone and not cust.get("phone"):
                            supabase.table("customers").update({"phone": clean_phone}).eq("id", cust["id"]).execute()
                            cust["phone"] = clean_phone
                        return cust

        # Step 3: CREATE NEW CUSTOMER PROFILE if no mobile or name match found
        if raw_name or clean_phone:
            display_name = base_name.capitalize() if base_name else (raw_name or f"Customer-{clean_phone[-4:]}")
            new_cust = {
                "shop_id": shop_id,
                "name": display_name,
                "phone": clean_phone or None,
                "udhaar_balance": 0.0
            }
            ins_res = supabase.table("customers").insert(new_cust).execute()
            if ins_res.data and len(ins_res.data) > 0:
                print(f"Created new customer profile '{new_cust['name']}' ({new_cust['phone']}) for shop {shop_id}")
                return ins_res.data[0]
    except Exception as e:
        print(f"Error in get_or_create_customer: {e}")

    return None

async def create_smart_bill(
    shop_id: str,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    items: List[Dict[str, Any]] = [],
    is_udhaar: bool = False,
    discount_amount: Optional[float] = None,
    custom_udhaar_amount: Optional[float] = None,
    custom_paid_amount: Optional[float] = None,
    image_bytes: Optional[bytes] = None,
    send_sms: bool = True
) -> Dict[str, Any]:
    """
    Unified AI Billing, Inventory Deduction & Vendal SMS Engine:
    1. Identifies/Creates Customer profile in ledger.
    2. Matches items against shop inventory catalog.
    3. Calculates item prices, applies discounts & udhaar.
    4. Automatically DEDUCTS stock from Supabase database.
    5. Saves Bill & Bill Items.
    6. Updates Customer Udhaar Balance & Logs Credit if unpaid.
    7. Dispatches Digital Bill SMS via Vendal API if customer phone is present.
    """
    supabase = get_supabase()
    
    # Step 1: Customer Identification & Profile Lookup
    customer = None
    if customer_name or customer_phone:
        customer = await get_or_create_customer(shop_id, customer_name, customer_phone)

    processed_items = []
    total_bill_amount = 0.0
    items_summary_list = []

    # Step 2: Process each item & deduct stock
    for item in items:
        raw_name = item.get("product_name") or item.get("name") or "Item"
        qty = float(item.get("quantity") or 1.0)
        unit = item.get("unit") or "packet"
        custom_price = item.get("selling_price")

        # Inventory Lookup
        matched = await find_existing_product(
            shop_id=shop_id,
            candidate_name=raw_name,
            image_bytes=image_bytes
        )

        if matched:
            product_id = str(matched.get("id"))
            actual_name = matched.get("name")
            unit_price = float(custom_price or matched.get("selling_price") or 0.0)
            
            # AUTOMATIC INVENTORY DEDUCTION (Stock = Stock - SoldQty)
            await update_product_stock(
                product_id=product_id,
                shop_id=shop_id,
                deduct_quantity=qty
            )
        else:
            product_id = None
            actual_name = raw_name
            unit_price = float(custom_price or 10.0)

        item_total = round(qty * unit_price, 2)
        total_bill_amount += item_total
        items_summary_list.append(f"{actual_name} x{qty}")

        processed_items.append({
            "product_id": product_id,
            "product_name": actual_name,
            "quantity": qty,
            "unit": unit,
            "unit_price": unit_price,
            "total_price": item_total
        })

    gross_bill_amount = round(total_bill_amount, 2)
    eff_discount = float(discount_amount or 0.0)
    net_bill_amount = max(0.0, round(gross_bill_amount - eff_discount, 2))

    # Calculate Paid vs Udhaar Amount
    if custom_udhaar_amount is not None and float(custom_udhaar_amount) > 0:
        udhaar_amount = min(net_bill_amount, float(custom_udhaar_amount))
        paid_amount = round(net_bill_amount - udhaar_amount, 2)
    elif is_udhaar:
        paid_amount = float(custom_paid_amount or 0.0)
        udhaar_amount = max(0.0, round(net_bill_amount - paid_amount, 2))
    else:
        paid_amount = float(custom_paid_amount if custom_paid_amount is not None else net_bill_amount)
        udhaar_amount = max(0.0, round(net_bill_amount - paid_amount, 2))

    payment_mode = "UDHAAR" if udhaar_amount > 0 else "CASH"

    bill_record = {
        "shop_id": shop_id,
        "customer_id": str(customer.get("id")) if customer else None,
        "customer_name": customer.get("name") if customer else (customer_name or "Cash Customer"),
        "total_amount": net_bill_amount,
        "paid_amount": paid_amount,
        "udhaar_amount": udhaar_amount,
        "payment_mode": payment_mode,
        "status": "COMPLETED"
    }

    # Step 3: Save Bill to Supabase
    bill_id = f"BILL-{int(time.time())}"
    saved_bill = bill_record
    if supabase:
        try:
            b_res = supabase.table("bills").insert(bill_record).execute()
            if b_res.data and len(b_res.data) > 0:
                saved_bill = b_res.data[0]
                bill_id = str(saved_bill.get("id"))

                # Save Bill Items
                for p_item in processed_items:
                    p_item["bill_id"] = bill_id
                    supabase.table("bill_items").insert(p_item).execute()
        except Exception as e:
            print(f"Error saving bill to Supabase: {e}")

    # Step 4: Update Udhaar Ledger if unpaid
    old_udhaar_balance = float(customer.get("udhaar_balance", 0.0)) if customer else 0.0
    new_udhaar_balance = old_udhaar_balance

    if customer and udhaar_amount > 0 and supabase:
        try:
            new_udhaar_balance = round(old_udhaar_balance + udhaar_amount, 2)
            
            # Update customer balance
            supabase.table("customers").update({"udhaar_balance": new_udhaar_balance}).eq("id", customer["id"]).execute()

            # Log Udhaar Entry
            supabase.table("udhaar_logs").insert({
                "shop_id": shop_id,
                "customer_id": customer["id"],
                "type": "UDHAAR_ADDED",
                "amount": udhaar_amount,
                "balance_after": new_udhaar_balance,
                "notes": f"Bill #{bill_id[-6:]}"
            }).execute()
        except Exception as e:
            print(f"Error updating customer udhaar: {e}")

    # Step 5: Vendal SMS Automated Dispatch
    sms_res = None
    target_phone = customer_phone or (customer.get("phone") if customer else None)
    if send_sms and target_phone:
        sms_res = await send_bill_sms(
            to_phone=target_phone,
            customer_name=customer.get("name") if customer else (customer_name or "Customer"),
            total_amount=net_bill_amount,
            udhaar_amount=udhaar_amount,
            total_udhaar_balance=new_udhaar_balance,
            items=processed_items,
            paid_amount=paid_amount,
            items_summary=", ".join(items_summary_list)
        )

    # Build Hindi Audio Guidance Response
    c_name = customer.get("name") if customer else (customer_name or "")
    cust_str = f" for {c_name}" if c_name else ""
    disc_str = f" (₹{eff_discount} discount)" if eff_discount > 0 else ""
    sms_str = " (SMS sent via Vendal)" if sms_res and sms_res.get("success") else ""

    if udhaar_amount > 0:
        ai_msg = f"Bill ready{cust_str}! Total ₹{net_bill_amount}{disc_str}. ₹{udhaar_amount} Udhaar me add kar diya. Purana Udhaar: ₹{old_udhaar_balance}, Kul Udhaar: ₹{new_udhaar_balance}.{sms_str}"
    elif customer and old_udhaar_balance > 0:
        ai_msg = f"Bill ready{cust_str}! Total ₹{net_bill_amount}{disc_str} Nagad mila. Dhyaan dein: {c_name} ka purana Udhaar ₹{old_udhaar_balance} pehle se baaki hai.{sms_str}"
    else:
        ai_msg = f"Bill ready{cust_str}! Total ₹{net_bill_amount}{disc_str} Nagad mil gaya.{sms_str}"

    return {
        "success": True,
        "bill_id": bill_id,
        "customer": customer,
        "customer_name": c_name or "Cash Customer",
        "previous_udhaar_balance": old_udhaar_balance,
        "total_udhaar_balance": new_udhaar_balance,
        "total_amount": net_bill_amount,
        "gross_amount": gross_bill_amount,
        "discount_amount": eff_discount,
        "paid_amount": paid_amount,
        "udhaar_amount": udhaar_amount,
        "items": processed_items,
        "sms_status": sms_res.get("status") if sms_res else ("NO_PHONE" if not target_phone else "SKIPPED"),
        "ai_response": ai_msg
    }

async def record_udhaar_payment(
    shop_id: str,
    customer_name: Optional[str] = None,
    customer_id: Optional[str] = None,
    amount: float = 0.0,
    send_sms: bool = True
) -> Dict[str, Any]:
    """
    Records an Udhaar debt settlement payment when customer pays later.
    e.g. "Ravi paid ₹500" -> Balance reduces by ₹500 + dispatches SMS receipt.
    """
    supabase = get_supabase()
    if not supabase:
        return {"success": False, "detail": "DB client unavailable"}

    customer = None
    try:
        if customer_id:
            res = supabase.table("customers").select("*").eq("id", customer_id).execute()
            if res.data: customer = res.data[0]
        elif customer_name:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).ilike("name", customer_name.strip()).execute()
            if res.data: customer = res.data[0]

        if not customer:
            return {"success": False, "ai_response": f"Customer '{customer_name}' not found in Udhaar register."}

        curr_balance = float(customer.get("udhaar_balance", 0.0))
        new_balance = max(0.0, round(curr_balance - float(amount), 2))

        # Update customer balance
        supabase.table("customers").update({"udhaar_balance": new_balance}).eq("id", customer["id"]).execute()

        # Log Udhaar Payment
        supabase.table("udhaar_logs").insert({
            "shop_id": shop_id,
            "customer_id": customer["id"],
            "type": "PAYMENT_RECEIVED",
            "amount": float(amount),
            "balance_after": new_balance,
            "notes": "Udhaar payment received"
        }).execute()

        # Send Payment Confirmation SMS via Vendal
        sms_res = None
        if send_sms and customer.get("phone"):
            sms_res = await send_payment_received_sms(
                to_phone=customer["phone"],
                customer_name=customer["name"],
                paid_amount=float(amount),
                remaining_balance=new_balance
            )

        sms_msg = " SMS receipt sent." if sms_res and sms_res.get("success") else ""
        ai_msg = f"{customer['name']} ne ₹{amount} jama kiye! Purana Udhaar ₹{curr_balance} se kam hokar ab ₹{new_balance} bacha hai.{sms_msg}"
        return {
            "success": True,
            "customer_name": customer["name"],
            "customer_phone": customer.get("phone"),
            "paid_amount": amount,
            "old_balance": curr_balance,
            "new_balance": new_balance,
            "sms_status": sms_res.get("status") if sms_res else "SKIPPED",
            "ai_response": ai_msg
        }
    except Exception as e:
        print(f"Error in record_udhaar_payment: {e}")
        return {"success": False, "detail": str(e)}

async def get_customer_history(shop_id: str, customer_id: str) -> Dict[str, Any]:
    """
    Fetches full transaction history (bills, debt additions, payment receipts) for a customer profile.
    """
    supabase = get_supabase()
    if not supabase:
        return {"bills": [], "logs": []}

    try:
        b_res = supabase.table("bills").select("*").eq("shop_id", shop_id).eq("customer_id", customer_id).order("created_at", desc=True).execute()
        l_res = supabase.table("udhaar_logs").select("*").eq("shop_id", shop_id).eq("customer_id", customer_id).order("created_at", desc=True).execute()

        return {
            "bills": b_res.data or [],
            "logs": l_res.data or []
        }
    except Exception as e:
        print(f"Error fetching customer history: {e}")
        return {"bills": [], "logs": []}

async def get_udhaar_summary(shop_id: str) -> Dict[str, Any]:
    """
    Returns summary overview of total pending Udhaar debt across all shop customers.
    """
    supabase = get_supabase()
    if not supabase:
        return {"total_pending_udhaar": 0.0, "total_defaulters": 0, "customers": []}

    try:
        res = supabase.table("customers").select("*").eq("shop_id", shop_id).gt("udhaar_balance", 0).order("udhaar_balance", desc=True).execute()
        defaulters = res.data or []
        total_pending = sum(float(c.get("udhaar_balance", 0)) for c in defaulters)

        return {
            "total_pending_udhaar": round(total_pending, 2),
            "total_defaulters": len(defaulters),
            "customers": defaulters
        }
    except Exception as e:
        print(f"Error fetching udhaar summary: {e}")
        return {"total_pending_udhaar": 0.0, "total_defaulters": 0, "customers": []}

async def attach_phone_to_customer_and_bill(
    shop_id: str,
    phone: str,
    customer_id: Optional[str] = None,
    bill_id: Optional[str] = None,
    customer_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Saves/updates customer 10-digit mobile phone number in database/store,
    links it to the bill, and dispatches Vendel Digital Bill SMS receipt.
    """
    clean_phone = re.sub(r'\D', '', (phone or "").strip())
    if not clean_phone or len(clean_phone) < 10:
        return {"success": False, "detail": "Valid 10-digit mobile phone number is required"}

    supabase = get_supabase()
    cust_data = None
    bill_data = None

    if supabase:
        try:
            # 1. Update customer profile
            if customer_id:
                res = supabase.table("customers").update({"phone": clean_phone}).eq("id", customer_id).execute()
                if res.data: cust_data = res.data[0]
            elif customer_name:
                cust_data = await get_or_create_customer(shop_id=shop_id, name=customer_name, phone=clean_phone)

            # 2. Update bill record with phone
            if bill_id:
                res_b = supabase.table("bills").update({"customer_phone": clean_phone}).eq("id", bill_id).execute()
                if res_b.data: bill_data = res_b.data[0]
        except Exception as e:
            print(f"Error attaching phone in Supabase: {e}")

    # 3. Dispatch Vendel Digital Bill SMS
    total_amt = float(bill_data.get("total_amount", 0.0)) if bill_data else 0.0
    udh_amt = float(bill_data.get("udhaar_amount", 0.0)) if bill_data else 0.0
    cust_name = (cust_data.get("name") if cust_data else customer_name) or "Customer"
    bal = float(cust_data.get("udhaar_balance", 0.0)) if cust_data else udh_amt

    sms_res = await send_bill_sms(
        to_phone=clean_phone,
        customer_name=cust_name,
        total_amount=total_amt,
        udhaar_amount=udh_amt,
        total_udhaar_balance=bal
    )

    return {
        "success": True,
        "customer_phone": clean_phone,
        "customer_name": cust_name,
        "sms_status": sms_res.get("status", "SENT"),
        "ai_response": f"Mobile number {clean_phone} saved! Vendel Digital Bill SMS dispatched to {cust_name}."
    }

async def get_sales_analytics(shop_id: str = settings.DEFAULT_SHOP_ID, period: str = "today") -> Dict[str, Any]:
    """
    Computes simple, numbers-only sales analytics (Daily, Weekly, Monthly, All-Time)
    and fetches stored receipts for Indian Dukandars.
    """
    supabase = get_supabase()
    bills = []
    bill_items = []

    if supabase:
        try:
            b_res = supabase.table("bills").select("*").eq("shop_id", shop_id).order("created_at", desc=True).execute()
            bills = b_res.data or []
            i_res = supabase.table("bill_items").select("*").execute()
            bill_items = i_res.data or []
        except Exception as e:
            print(f"Error fetching bills for analytics: {e}")

    # Time filtering helper
    now_ts = time.time()
    period_lower = period.lower()

    if period_lower == "today":
        cutoff_ts = now_ts - 86400  # 24 hours
    elif period_lower == "week":
        cutoff_ts = now_ts - (7 * 86400) # 7 days
    elif period_lower == "month":
        cutoff_ts = now_ts - (30 * 86400) # 30 days
    else:
        cutoff_ts = 0  # All time

    filtered_bills = []
    for b in bills:
        created_at_str = b.get("created_at")
        if created_at_str:
            try:
                import datetime
                dt = datetime.datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                b_ts = dt.timestamp()
            except Exception:
                b_ts = now_ts
        else:
            b_ts = now_ts

        if b_ts >= cutoff_ts:
            filtered_bills.append(b)

    total_sales = sum(float(b.get("total_amount", 0.0)) for b in filtered_bills)
    cash_sales = sum(float(b.get("paid_amount", 0.0)) for b in filtered_bills if b.get("payment_mode") == "CASH" or float(b.get("udhaar_amount", 0.0)) == 0)
    udhaar_sales = sum(float(b.get("udhaar_amount", 0.0)) for b in filtered_bills)
    total_bills_count = len(filtered_bills)

    # Calculate Top Products Sold
    product_stats = {}
    for item in bill_items:
        p_name = item.get("product_name") or "Item"
        qty = float(item.get("quantity", 1.0))
        rev = float(item.get("total_price", 0.0))

        if p_name not in product_stats:
            product_stats[p_name] = {"name": p_name, "quantity_sold": 0.0, "total_revenue": 0.0}
        product_stats[p_name]["quantity_sold"] += qty
        product_stats[p_name]["total_revenue"] += rev

    top_products = sorted(list(product_stats.values()), key=lambda x: x["quantity_sold"], reverse=True)[:5]

    return {
        "period": period_lower,
        "total_sales": round(total_sales, 2),
        "total_bills_count": total_bills_count,
        "cash_sales": round(cash_sales, 2),
        "udhaar_sales": round(udhaar_sales, 2),
        "top_products": top_products,
        "receipts": filtered_bills
    }

async def broadcast_weekly_udhaar_reminders(shop_id: str = settings.DEFAULT_SHOP_ID) -> Dict[str, Any]:
    """
    Automated / 1-Tap Weekly Kirana Udhaar SMS Broadcast Engine:
    Dispatches polite payment reminder SMS to all shop customers with pending debt.
    Logs broadcast results and delivery status for each recipient.
    """
    supabase = get_supabase()
    defaulters = []

    if supabase:
        try:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).gt("udhaar_balance", 0).execute()
            defaulters = res.data or []
        except Exception as e:
            print(f"Error fetching defaulters for weekly broadcast: {e}")

    recipient_logs = []
    sent_count = 0
    no_phone_count = 0

    for cust in defaulters:
        c_name = cust.get("name") or "Customer"
        c_phone = cust.get("phone")
        bal = float(cust.get("udhaar_balance", 0.0))

        if c_phone and c_phone.strip():
            sms_res = await send_udhaar_reminder_sms(
                to_phone=c_phone,
                customer_name=c_name,
                udhaar_balance=bal
            )
            status = sms_res.get("status", "SENT")
            sent_count += 1
            recipient_logs.append({
                "customer_id": str(cust.get("id")),
                "customer_name": c_name,
                "phone": c_phone,
                "udhaar_balance": bal,
                "sms_status": status,
                "message_id": sms_res.get("message_id"),
                "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "message": f"Namaste {c_name} ji! Dukan Kirana se aapka kul Kirana Udhaar Rs.{bal:.2f} baaki hai. Kripya is hafte isse chukayein. Dhanyawad!"
            })
        else:
            no_phone_count += 1
            recipient_logs.append({
                "customer_id": str(cust.get("id")),
                "customer_name": c_name,
                "phone": None,
                "udhaar_balance": bal,
                "sms_status": "NO_PHONE",
                "message_id": None,
                "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "message": f"Namaste {c_name} ji! Dukan Kirana se aapka kul Kirana Udhaar Rs.{bal:.2f} baaki hai. (Phone missing)"
            })

    total_udhaar = round(sum(r["udhaar_balance"] for r in recipient_logs), 2)
    broadcast_record = {
        "id": f"BCAST-{int(time.time())}",
        "shop_id": shop_id,
        "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_defaulters": len(defaulters),
        "total_sent": sent_count,
        "total_no_phone": no_phone_count,
        "total_udhaar_reminded": total_udhaar,
        "recipients": recipient_logs
    }

    if supabase:
        try:
            supabase.table("weekly_sms_broadcasts").insert(broadcast_record).execute()
        except Exception as e:
            print(f"Notice saving weekly broadcast log: {e}")

    return {
        "success": True,
        "broadcast_id": broadcast_record["id"],
        "shop_id": shop_id,
        "sent_at": broadcast_record["sent_at"],
        "total_defaulters": len(defaulters),
        "total_sent": sent_count,
        "total_no_phone": no_phone_count,
        "total_udhaar_reminded": total_udhaar,
        "recipients": recipient_logs,
        "ai_response": f"Weekly Kirana Udhaar SMS Broadcast complete! Sent {sent_count} reminders via Vendel Gateway for total ₹{total_udhaar} pending debt."
    }

async def get_weekly_broadcast_logs(shop_id: str = settings.DEFAULT_SHOP_ID) -> Dict[str, Any]:
    """
    Fetches past weekly Udhaar SMS broadcast logs & recipient delivery statuses.
    """
    supabase = get_supabase()
    logs = []

    if supabase:
        try:
            res = supabase.table("weekly_sms_broadcasts").select("*").eq("shop_id", shop_id).order("sent_at", desc=True).execute()
            logs = res.data or []
        except Exception as e:
            print(f"Error fetching weekly broadcast logs: {e}")

    return {"broadcast_logs": logs}
