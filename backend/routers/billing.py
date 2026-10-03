from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from config import settings
from db import get_supabase
from services.billing_service import create_smart_bill, record_udhaar_payment, get_or_create_customer
from services.voice_service import process_voice_audio
from services.vision_service import extract_label_from_image

router = APIRouter(prefix="/api/v1", tags=["AI Billing & Udhaar Engine"])

class ManualBillRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[Dict[str, Any]]
    is_udhaar: bool = False
    custom_paid_amount: Optional[float] = None

class UdhaarPaymentRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    customer_name: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float

@router.post("/create-bill")
async def create_bill_endpoint(
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    shop_id: str = Form(settings.DEFAULT_SHOP_ID),
    customer_name: Optional[str] = Form(None),
    customer_phone: Optional[str] = Form(None),
    is_udhaar: bool = Form(False)
):
    """
    1-Tap / 1-Voice AI Billing Engine:
    - Parses Image (Gemini Flash Vision) + Voice Note (Groq Whisper NLU).
    - Extracts Customer Name, Products, Quantities, Units.
    - Matches items against shop inventory & DEDUCTS STOCK.
    - Updates Customer Udhaar ledger if unpaid.
    - Returns digital receipt & spoken Hindi TTS response.
    """
    image_bytes = await image.read() if image else None
    audio_bytes = await audio.read() if audio else None

    # Parse voice note if provided
    voice_data = {}
    if audio_bytes:
        voice_data = await process_voice_audio(audio_bytes, filename=audio.filename or "voice.webm")

    # If action is UDHAAR_PAYMENT (e.g. "Ravi paid 500 rupees")
    if voice_data.get("action_type") == "UDHAAR_PAYMENT" and voice_data.get("udhaar_payment_amount"):
        cust_name = voice_data.get("customer_name") or customer_name
        amount = voice_data.get("udhaar_payment_amount")
        return await record_udhaar_payment(shop_id=shop_id, customer_name=cust_name, amount=amount)

    # Determine Customer
    eff_cust_name = voice_data.get("customer_name") or customer_name
    eff_cust_phone = voice_data.get("customer_phone") or customer_phone
    eff_is_udhaar = is_udhaar or voice_data.get("is_udhaar", False)

    # Determine Items
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
        items.append({
            "product_name": voice_data.get("product_name") or "Tic-Tac",
            "quantity": float(voice_data.get("quantity") or 1.0),
            "unit": voice_data.get("unit") or "packet"
        })

    return await create_smart_bill(
        shop_id=shop_id,
        customer_name=eff_cust_name,
        customer_phone=eff_cust_phone,
        items=items,
        is_udhaar=eff_is_udhaar,
        image_bytes=image_bytes
    )

@router.post("/udhaar/payment")
async def udhaar_payment_endpoint(req: UdhaarPaymentRequest):
    """
    Records an Udhaar debt settlement payment when customer pays later.
    e.g. "Ravi paid ₹500" -> Balance reduces by ₹500.
    """
    return await record_udhaar_payment(
        shop_id=req.shop_id,
        customer_name=req.customer_name,
        customer_id=req.customer_id,
        amount=req.amount
    )

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
