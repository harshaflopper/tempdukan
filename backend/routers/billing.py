import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from config import settings
from db import get_supabase
from services.billing_service import (
    create_smart_bill,
    record_udhaar_payment,
    get_or_create_customer,
    get_customer_history,
    get_udhaar_summary,
    attach_phone_to_customer_and_bill,
    get_sales_analytics
)
from services.sms_service import send_udhaar_reminder_sms
from services.voice_service import process_voice_audio, parse_transcript_with_gemini
from services.vision_service import extract_label_from_image

router = APIRouter(prefix="/api/v1", tags=["AI Billing & Udhaar Engine"])

class ManualBillRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[Dict[str, Any]]
    is_udhaar: bool = False
    discount_amount: Optional[float] = None
    custom_udhaar_amount: Optional[float] = None
    custom_paid_amount: Optional[float] = None
    send_sms: bool = True

class UdhaarPaymentRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    customer_name: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    send_sms: bool = True

class SendReminderRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    customer_id: str
    phone: Optional[str] = None

class AddPhoneRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    phone: str
    customer_id: Optional[str] = None
    bill_id: Optional[str] = None
    customer_name: Optional[str] = None

@router.post("/create-bill")
async def create_bill_endpoint(
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    shop_id: str = Form(settings.DEFAULT_SHOP_ID),
    customer_name: Optional[str] = Form(None),
    customer_phone: Optional[str] = Form(None),
    is_udhaar: bool = Form(False),
    discount_amount: Optional[float] = Form(None),
    custom_udhaar_amount: Optional[float] = Form(None),
    send_sms: bool = Form(True),
    text_prompt: Optional[str] = Form(None),
    items_json: Optional[str] = Form(None)
):
    """
    1-Tap / 1-Voice / 1-Text AI Billing Engine:
    - Parses Image (Gemini Flash Vision) + Voice Note (Groq Whisper NLU) + Spoken/Typed Text Prompt.
    - Matches items strictly against shop inventory catalog.
    - Extracts Customer Name, Mobile Phone, Products, Quantities, Discounts & Udhaar amount.
    - DEDUCTS STOCK from Supabase database.
    - Updates Customer Udhaar ledger if unpaid.
    - Dispatches Vendal Digital Bill SMS.
    """
    image_bytes = await image.read() if image else None
    audio_bytes = await audio.read() if audio else None

    voice_data = {}
    if audio_bytes:
        voice_data = await process_voice_audio(audio_bytes, filename=audio.filename or "voice.webm", shop_id=shop_id)
    elif text_prompt and text_prompt.strip():
        voice_data = await parse_transcript_with_gemini(text_prompt.strip(), shop_id=shop_id)

    # If action is UDHAAR_PAYMENT (e.g. "Ravi paid 500 rupees")
    if voice_data.get("action_type") == "UDHAAR_PAYMENT" and voice_data.get("udhaar_payment_amount"):
        cust_name = voice_data.get("customer_name") or customer_name
        amount = voice_data.get("udhaar_payment_amount")
        return await record_udhaar_payment(shop_id=shop_id, customer_name=cust_name, amount=amount, send_sms=send_sms)

    # Determine Customer Profile Details
    eff_cust_name = voice_data.get("customer_name") or customer_name
    eff_cust_phone = voice_data.get("customer_phone") or customer_phone
    eff_is_udhaar = is_udhaar or voice_data.get("is_udhaar", False)
    eff_discount = discount_amount if discount_amount is not None else voice_data.get("discount_amount")
    eff_udhaar_amount = custom_udhaar_amount if custom_udhaar_amount is not None else voice_data.get("udhaar_amount")

    # Determine Items
    items = []
    if items_json:
        try:
            items = json.loads(items_json)
        except Exception:
            items = []

    if not items:
        items = voice_data.get("items") or []

    if not items and image_bytes:
        ocr_data = await extract_label_from_image(image_bytes) or {}
        if ocr_data.get("product_name"):
            items.append({
                "product_name": ocr_data.get("product_name"),
                "quantity": 1.0,
                "unit": "packet",
                "selling_price": ocr_data.get("printed_mrp")
            })

    if not items:
        raise HTTPException(
            status_code=400,
            detail="AI could not recognize products from the voice note or photo. Please speak clearly, e.g. 'Ravi ji 2 Maggi packets'."
        )

    return await create_smart_bill(
        shop_id=shop_id,
        customer_name=eff_cust_name,
        customer_phone=eff_cust_phone,
        items=items,
        is_udhaar=eff_is_udhaar,
        discount_amount=eff_discount,
        custom_udhaar_amount=eff_udhaar_amount,
        image_bytes=image_bytes,
        send_sms=send_sms
    )

@router.post("/create-bill-direct")
async def create_bill_direct_endpoint(req: ManualBillRequest):
    """
    Direct JSON API endpoint for generating bills from structured frontend forms.
    Deducts stock automatically, updates customer Udhaar, and sends Vendal SMS.
    """
    return await create_smart_bill(
        shop_id=req.shop_id,
        customer_name=req.customer_name,
        customer_phone=req.customer_phone,
        items=req.items,
        is_udhaar=req.is_udhaar,
        discount_amount=req.discount_amount,
        custom_udhaar_amount=req.custom_udhaar_amount,
        custom_paid_amount=req.custom_paid_amount,
        send_sms=req.send_sms
    )

@router.post("/udhaar/payment")
async def udhaar_payment_endpoint(req: UdhaarPaymentRequest):
    """
    Records an Udhaar debt settlement payment when customer pays later.
    Dispatches Vendal payment receipt SMS.
    """
    return await record_udhaar_payment(
        shop_id=req.shop_id,
        customer_name=req.customer_name,
        customer_id=req.customer_id,
        amount=req.amount,
        send_sms=req.send_sms
    )

@router.post("/customers/send-reminder")
async def send_reminder_endpoint(req: SendReminderRequest):
    """
    Triggers Vendal SMS debt payment reminder to customer's mobile number.
    """
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client unavailable")

    res = supabase.table("customers").select("*").eq("id", req.customer_id).execute()
    if not res.data:
        raise HTTPException(status_code=444, detail="Customer not found")

    cust = res.data[0]
    target_phone = req.phone or cust.get("phone")
    if not target_phone:
        raise HTTPException(status_code=400, detail="Customer phone number is missing")

    sms_res = await send_udhaar_reminder_sms(
        to_phone=target_phone,
        customer_name=cust["name"],
        udhaar_balance=float(cust.get("udhaar_balance", 0))
    )

    return {
        "success": True,
        "customer": cust["name"],
        "phone": target_phone,
        "sms_status": sms_res.get("status"),
        "ai_response": f"Reminder SMS sent to {cust['name']} ({target_phone}) via Vendal!"
    }

@router.get("/customers/{customer_id}/history")
async def get_customer_history_endpoint(customer_id: str, shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Fetches full transaction & bill history for a customer profile.
    """
    return await get_customer_history(shop_id=shop_id, customer_id=customer_id)

@router.get("/udhaar/summary")
async def get_udhaar_summary_endpoint(shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Overview summary of all pending Udhaar debt.
    """
    return await get_udhaar_summary(shop_id=shop_id)

@router.get("/customers")
async def get_customers(shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Fetches all customers and their current Udhaar debt balances.
    """
    supabase = get_supabase()
    if not supabase:
        return {"customers": []}

    try:
        res = supabase.table("customers").select("*").eq("shop_id", shop_id).order("udhaar_balance", desc=True).execute()
        return {"customers": res.data or []}
    except Exception as e:
        return {"customers": [], "error": str(e)}

@router.get("/bills")
async def get_bills(shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Fetches recent bills generated in shop.
    """
    supabase = get_supabase()
    if not supabase:
        return {"bills": []}

    try:
        res = supabase.table("bills").select("*").eq("shop_id", shop_id).order("created_at", desc=True).limit(30).execute()
        return {"bills": res.data or []}
    except Exception as e:
        return {"bills": [], "error": str(e)}

@router.post("/bills/add-phone-and-send-sms")
async def add_phone_and_send_sms_endpoint(req: AddPhoneRequest):
    """
    Attaches customer 10-digit mobile number to profile & bill, and dispatches Vendel Digital Bill SMS.
    Does NOT close receipt view.
    """
    return await attach_phone_to_customer_and_bill(
        shop_id=req.shop_id,
        phone=req.phone,
        customer_id=req.customer_id,
        bill_id=req.bill_id,
        customer_name=req.customer_name
    )

@router.get("/analytics/sales")
async def get_sales_analytics_endpoint(
    shop_id: str = settings.DEFAULT_SHOP_ID,
    period: str = "today"
):
    """
    Computes simple, numbers-only sales analytics (Daily, Weekly, Monthly, All-Time)
    and fetches stored receipts for Indian Dukandars.
    """
    return await get_sales_analytics(shop_id=shop_id, period=period)
