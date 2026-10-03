import time
from typing import Dict, Any, List, Optional
from db import get_supabase
from config import settings
from services.shop_memory_service import find_existing_product, update_product_stock, save_product_to_shop_memory

async def get_or_create_customer(
    shop_id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Finds existing customer by name or phone, or creates a new customer in Supabase.
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
                return res.data[0]

        # Search by normalized name
        if clean_name:
            res = supabase.table("customers").select("*").eq("shop_id", shop_id).ilike("name", clean_name).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]

        # Create new customer record
        if clean_name:
            new_cust = {
                "shop_id": shop_id,
                "name": clean_name,
                "phone": clean_phone or None,
                "udhaar_balance": 0.0
            }
            ins_res = supabase.table("customers").insert(new_cust).execute()
            if ins_res.data and len(ins_res.data) > 0:
                print(f"Created new customer '{clean_name}' for shop {shop_id}")
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
    custom_paid_amount: Optional[float] = None,
    image_bytes: Optional[bytes] = None
) -> Dict[str, Any]:
    """
    Unified AI Billing & Stock Sync Event:
    1. Identifies/Creates Customer in ledger.
    2. Matches items against shop inventory.
    3. Calculates item prices & totals.
    4. Automatically DEDUCTS stock from Supabase database.
    5. Saves Bill & Bill Items.
    6. Updates Customer Udhaar Balance & Logs Credit if unpaid.
    7. Returns digital receipt + Hindi audio response string.
    """
    supabase = get_supabase()
    
    # Step 1: Customer Identification
    customer = None
    if customer_name or customer_phone:
        customer = await get_or_create_customer(shop_id, customer_name, customer_phone)

    processed_items = []
    total_bill_amount = 0.0

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

        processed_items.append({
            "product_id": product_id,
            "product_name": actual_name,
            "quantity": qty,
            "unit": unit,
            "unit_price": unit_price,
            "total_price": item_total
        })

    total_bill_amount = round(total_bill_amount, 2)

    # Calculate Paid vs Udhaar Amount
    if is_udhaar:
        paid_amount = float(custom_paid_amount or 0.0)
    else:
        paid_amount = float(custom_paid_amount if custom_paid_amount is not None else total_bill_amount)

    udhaar_amount = max(0.0, total_bill_amount - paid_amount)
    payment_mode = "UDHAAR" if udhaar_amount > 0 else "CASH"

    bill_record = {
        "shop_id": shop_id,
        "customer_id": str(customer.get("id")) if customer else None,
        "customer_name": customer.get("name") if customer else (customer_name or "Cash Customer"),
        "total_amount": total_bill_amount,
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
    new_udhaar_balance = 0.0
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

    # Build Hindi Audio Guidance Response
    cust_str = f" for {customer['name']}" if customer else ""
    if udhaar_amount > 0:
        ai_msg = f"Bill ready{cust_str}! Total ₹{total_bill_amount}. ₹{udhaar_amount} Udhaar me add kar diya. Total Udhaar: ₹{new_udhaar_balance}. Stock deducted!"
    else:
        ai_msg = f"Bill ready{cust_str}! Total ₹{total_bill_amount} received in Cash. Inventory updated!"

    return {
        "success": True,
        "bill_id": bill_id,
        "customer_name": customer.get("name") if customer else (customer_name or "Cash Customer"),
        "total_amount": total_bill_amount,
        "paid_amount": paid_amount,
        "udhaar_amount": udhaar_amount,
        "items": processed_items,
        "ai_response": ai_msg
    }

async def record_udhaar_payment(
    shop_id: str,
    customer_name: Optional[str] = None,
    customer_id: Optional[str] = None,
    amount: float = 0.0
) -> Dict[str, Any]:
    """
    Records an Udhaar debt settlement payment when customer pays later.
    e.g. "Ravi paid ₹500" -> Balance reduces by ₹500.
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

        ai_msg = f"{customer['name']} ne ₹{amount} jama kiye! Purana Udhaar ₹{curr_balance} se kam hokar ab ₹{new_balance} bacha hai."
        return {
            "success": True,
            "customer_name": customer["name"],
            "paid_amount": amount,
            "old_balance": curr_balance,
            "new_balance": new_balance,
            "ai_response": ai_msg
        }
    except Exception as e:
        print(f"Error in record_udhaar_payment: {e}")
        return {"success": False, "detail": str(e)}
