import time
from typing import Dict, Any, List, Optional
from db import get_supabase
from config import settings
from services.shop_memory_service import find_existing_product, update_product_stock, save_product_to_shop_memory
from services.sms_service import send_bill_sms, send_payment_received_sms, send_udhaar_reminder_sms

async def get_or_create_customer(
    shop_id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Finds existing customer by name or phone, or creates a new customer in Supabase.
    Auto-updates customer phone if provided.
    """
    supabase = get_supabase()
    if not supabase or (not name and not phone):
        return None

    clean_name = (name or "").strip()
    clean_phone = (phone or "").strip()

    try:
        # Search by phone if available
        if clean_phone:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).eq("phone", clean_phone).execute()
            if res.data and len(res.data) > 0:
                cust = res.data[0]
                if clean_name and cust.get("name") != clean_name:
                    supabase.table("customers").update({"name": clean_name}).eq("id", cust["id"]).execute()
                    cust["name"] = clean_name
                return cust

        # Search by normalized name
        if clean_name:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).ilike("name", clean_name).execute()
            if res.data and len(res.data) > 0:
                cust = res.data[0]
                if clean_phone and not cust.get("phone"):
                    supabase.table("customers").update({"phone": clean_phone}).eq("id", cust["id"]).execute()
                    cust["phone"] = clean_phone
                return cust

        # Create new customer profile
        if clean_name or clean_phone:
            new_cust = {
                "shop_id": shop_id,
                "name": clean_name or f"Customer-{clean_phone[-4:]}",
                "phone": clean_phone or None,
                "udhaar_balance": 0.0
            }
            ins_res = supabase.table("customers").insert(new_cust).execute()
            if ins_res.data and len(ins_res.data) > 0:
                print(f"Created new customer profile '{new_cust['name']}' for shop {shop_id}")
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
    new_udhaar_balance = float(customer.get("udhaar_balance", 0.0)) if customer else 0.0
    if customer and udhaar_amount > 0 and supabase:
        try:
            curr_balance = float(customer.get("udhaar_balance", 0.0))
            new_udhaar_balance = round(curr_balance + udhaar_amount, 2)
            
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
            items_summary=", ".join(items_summary_list[:3])
        )

    # Build Hindi Audio Guidance Response
    cust_str = f" for {customer['name']}" if customer else ""
    disc_str = f" (₹{eff_discount} discount)" if eff_discount > 0 else ""
    sms_str = " (SMS sent via Vendal)" if sms_res and sms_res.get("success") else ""

    if udhaar_amount > 0:
        ai_msg = f"Bill ready{cust_str}! Total ₹{net_bill_amount}{disc_str}. ₹{udhaar_amount} Udhaar me add kar diya. Total Udhaar: ₹{new_udhaar_balance}.{sms_str}"
    else:
        ai_msg = f"Bill ready{cust_str}! Total ₹{net_bill_amount}{disc_str} received in Cash.{sms_str}"

    return {
        "success": True,
        "bill_id": bill_id,
        "customer": customer,
        "customer_name": customer.get("name") if customer else (customer_name or "Cash Customer"),
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

        # Send Payment Confirmation SMS via Wendal
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
