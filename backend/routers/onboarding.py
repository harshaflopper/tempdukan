from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional, Dict, Any
from services.barcode_service import lookup_barcode
from services.vision_service import extract_label_from_image, generate_image_embedding
from services.voice_service import process_voice_audio
from services.shop_memory_service import (
    search_shop_visual_memory,
    save_product_to_shop_memory,
    find_existing_product,
    update_product_stock
)
from db import get_supabase
from config import settings

router = APIRouter(prefix="/api/v1", tags=["AI Conversational Product Onboarding"])

@router.post("/onboard")
async def onboard_product_signals(
    image: UploadFile = File(...),
    audio: Optional[UploadFile] = File(None),
    barcode: Optional[str] = Form(None),
    shop_id: str = Form(settings.DEFAULT_SHOP_ID)
):
    """
    Exact 2-Case Conversational AI Onboarding Engine:

    CASE 1: Photo ONLY (Sub-Option A)
    - Gemini 2.5 Flash Vision identifies product name + printed MRP.
    - Checks shop inventory for repeat product snap (via vector embedding or name).
    - If EXISTING: Returns existing stock/price details so seller can update/top-up.
    - If NEW: Pre-fills name + MRP and asks for stock and selling price.

    CASE 2: Photo + Spoken Voice Note
    - Groq Whisper transcribes audio + Gemini 2.5 Flash NLU parses intent.
    - Combines image & audio signals.
    - If EXISTING: Auto-increments existing stock in Supabase DB.
    - If NEW: Auto-saves new product directly in Supabase DB.
    """
    image_bytes = await image.read()
    audio_bytes = await audio.read() if audio else None

    # Step 1: Generate Visual Vector Embedding (for Shop Memory)
    image_embedding = await generate_image_embedding(image_bytes)

    # Signal 1: Gemini 2.5 Flash Vision AI Recognition
    ocr_result = await extract_label_from_image(image_bytes) or {}

    # Signal 2: Barcode (if provided)
    barcode_result = None
    if barcode:
        barcode_result = await lookup_barcode(barcode, shop_id)

    # Signal 3: Voice Audio Parsing (Groq Whisper + Gemini 2.5 Flash NLU)
    voice_result = {}
    if audio_bytes:
        voice_result = await process_voice_audio(audio_bytes, filename=audio.filename or "voice.webm")

    # Determine Candidate Product Name
    candidate_name = (
        voice_result.get("product_name") or
        ocr_result.get("product_name") or
        (barcode_result.get("name") if barcode_result else None) or
        ocr_result.get("brand") or
        "Unrecognized Item"
    )

    printed_mrp = ocr_result.get("printed_mrp")
    extracted_expiry = ocr_result.get("expiry_date")

    # Inventory Lookup for Existing Product Match (Multimodal Visual Image Match + Token Search)
    matched_existing_item = await find_existing_product(
        shop_id=shop_id,
        candidate_name=candidate_name if candidate_name != "Unrecognized Item" else None,
        query_embedding=image_embedding,
        image_bytes=image_bytes
    )

    # =========================================================================
    # CASE 1: PHOTO ONLY (User clicked photo, no voice note attached) - Sub Option A
    # =========================================================================
    if not audio_bytes or not voice_result.get("raw_transcript"):
        mrp_str = f" (Printed MRP ₹{printed_mrp})" if printed_mrp else ""

        # Sub-Option A1: REPEAT PRODUCT SNAP -> MATCHED EXISTING ITEM IN SHOP INVENTORY
        if matched_existing_item:
            matched_name = matched_existing_item.get("name")
            current_stock = float(matched_existing_item.get("quantity", 0))
            current_price = float(matched_existing_item.get("selling_price", 0))
            return {
                "case": 1,
                "status": "PHOTO_ONLY_REPEAT_MATCH",
                "is_existing": True,
                "product_name": matched_name,
                "printed_mrp": printed_mrp or current_price,
                "expiry_date": matched_existing_item.get("expiry_date") or extracted_expiry,
                "ai_response": f"Recognized repeat product '{matched_name}' in inventory! Current stock: {current_stock} units @ ₹{current_price}. Top up stock or update price below.",
                "existing_product": matched_existing_item,
                "visual_embedding": image_embedding
            }

        # Sub-Option A2: NEW PRODUCT SNAP
        return {
            "case": 1,
            "status": "PHOTO_ONLY_NEW_PRODUCT",
            "is_existing": False,
            "product_name": candidate_name,
            "printed_mrp": printed_mrp,
            "expiry_date": extracted_expiry,
            "ai_response": f"I see '{candidate_name}'{mrp_str}! Enter quantity and selling price to add to your shop inventory.",
            "visual_embedding": image_embedding
        }

    # =========================================================================
    # CASE 2: PHOTO + VOICE AUDIO NOTE (Hindi / Hinglish / English)
    # =========================================================================
    spoken_qty = float(voice_result.get("quantity") or 1)
    unit = voice_result.get("unit") or (matched_existing_item.get("unit") if matched_existing_item else "packet")
    selling_price = float(voice_result.get("selling_price") or printed_mrp or (matched_existing_item.get("selling_price") if matched_existing_item else 0.0))
    is_loose = voice_result.get("is_loose", False)
    price_unit = voice_result.get("price_unit", "per_item")
    expiry_date = voice_result.get("expiry_date") or (matched_existing_item.get("expiry_date") if matched_existing_item else None)

    # Sub-Case 2A: REPEAT PRODUCT MATCH -> AUTO INCREMENT EXISTING STOCK IN SUPABASE
    if matched_existing_item:
        existing_qty = float(matched_existing_item.get("quantity", 0))
        item_id = matched_existing_item.get("id")

        updated_item = await update_product_stock(
            product_id=str(item_id),
            shop_id=shop_id,
            add_quantity=spoken_qty,
            selling_price=selling_price if selling_price > 0 else None
        )

        final_qty = existing_qty + spoken_qty
        ai_msg = f"Done! Updated stock for '{matched_existing_item.get('name')}' from {existing_qty} to {final_qty} {unit}s."
        return {
            "case": 2,
            "status": "REPEAT_PRODUCT_STOCK_UPDATED",
            "is_existing": True,
            "ai_response": ai_msg,
            "product": updated_item or {
                "id": item_id,
                "name": matched_existing_item.get("name"),
                "quantity": final_qty,
                "unit": unit,
                "selling_price": selling_price
            }
        }

    # Sub-Case 2B: NEW PRODUCT -> SAVE DIRECTLY TO SUPABASE DB
    new_product_record = {
        "shop_id": shop_id,
        "name": candidate_name,
        "brand": ocr_result.get("brand", ""),
        "category": ocr_result.get("category", "General"),
        "selling_price": selling_price,
        "quantity": spoken_qty,
        "unit": unit,
        "is_loose": is_loose,
        "price_unit": price_unit,
        "expiry_date": expiry_date,
        "barcode": barcode or (barcode_result.get("barcode") if barcode_result else None),
        "visual_embedding": image_embedding
    }

    saved_item = await save_product_to_shop_memory(shop_id, new_product_record)

    price_str = f"₹{selling_price}/kg" if is_loose else f"₹{selling_price}/{unit}"
    ai_msg = f"Done! Added {spoken_qty} {unit}s of '{candidate_name}' at {price_str} directly to your shop inventory."

    return {
        "case": 2,
        "status": "NEW_PRODUCT_SAVED_DIRECT",
        "is_existing": False,
        "ai_response": ai_msg,
        "product": saved_item or new_product_record
    }
