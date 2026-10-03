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
    shop_id: str = Form(settings.DEFAULT_SHOP_ID),
    mode: Optional[str] = Form("AUTO")
):
    """
    Automatic Inventory Sync Engine for Village Dukandars:
    - Analyzes Photo (Gemini 2.5 Flash Vision) + Voice Note (Groq Whisper NLU) + Barcode.
    - Matches product in Shop Memory (Multimodal Vision + Embedding + Token match).
    - Executes Intent Action:
      1. SALE (Bikri): Deducts stock (Stock = Stock - SoldQty)
      2. RESTOCK (Maal Aaya): Increments stock (Stock = Stock + RecvQty)
      3. DAMAGE (Kharab/Loss): Deducts stock (Stock = Stock - LossQty)
      4. CORRECTION (Stock Audit): Sets stock directly (Stock = CountQty)
    - Returns Hindi Voice Audio Guidance.
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

    # Determine Effective Action Type (Voice NLU intent overrides UI mode if specific)
    voice_action = voice_result.get("action_type", "AUTO")
    if voice_action != "AUTO":
        action_type = voice_action
    elif mode in ("SALE", "RESTOCK", "DAMAGE", "CORRECTION"):
        action_type = mode
    else:
        action_type = "RESTOCK"

    # =========================================================================
    # CASE 1: PHOTO ONLY (User clicked photo, no voice note attached)
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
                "action_type": action_type,
                "is_existing": True,
                "product_name": matched_name,
                "printed_mrp": printed_mrp or current_price,
                "expiry_date": matched_existing_item.get("expiry_date") or extracted_expiry,
                "ai_response": f"Recognized '{matched_name}' in shop! Stock: {current_stock} {matched_existing_item.get('unit','packet')}s @ ₹{current_price}. Choose action below.",
                "existing_product": matched_existing_item,
                "visual_embedding": image_embedding
            }

        # Sub-Option A2: NEW PRODUCT SNAP
        return {
            "case": 1,
            "status": "PHOTO_ONLY_NEW_PRODUCT",
            "action_type": action_type,
            "is_existing": False,
            "product_name": candidate_name,
            "printed_mrp": printed_mrp,
            "expiry_date": extracted_expiry,
            "ai_response": f"I see '{candidate_name}'{mrp_str}! Enter price and stock quantity to save to your inventory.",
            "visual_embedding": image_embedding
        }

    # =========================================================================
    # CASE 2: PHOTO + VOICE AUDIO NOTE (Hindi / Hinglish / English)
    # =========================================================================
    spoken_qty = float(voice_result.get("quantity") or 1.0)
    unit = voice_result.get("unit") or (matched_existing_item.get("unit") if matched_existing_item else "packet")
    selling_price = float(voice_result.get("selling_price") or printed_mrp or (matched_existing_item.get("selling_price") if matched_existing_item else 0.0))
    is_loose = voice_result.get("is_loose", False)
    price_unit = voice_result.get("price_unit", "per_item")
    expiry_date = voice_result.get("expiry_date") or (matched_existing_item.get("expiry_date") if matched_existing_item else None)

    # Sub-Case 2A: REPEAT PRODUCT MATCH -> EXECUTE DYNAMIC STOCK TRANSACTION IN DB
    if matched_existing_item:
        existing_qty = float(matched_existing_item.get("quantity", 0))
        item_id = str(matched_existing_item.get("id"))
        matched_name = matched_existing_item.get("name")

        if action_type == "SALE":
            updated_item = await update_product_stock(
                product_id=item_id,
                shop_id=shop_id,
                deduct_quantity=spoken_qty,
                selling_price=selling_price if selling_price > 0 else None
            )
            final_qty = max(0.0, existing_qty - spoken_qty)
            ai_msg = f"Bikri Done! '{matched_name}' ka stock {existing_qty} se घटकर {final_qty} {unit} ho gaya."

        elif action_type == "DAMAGE":
            updated_item = await update_product_stock(
                product_id=item_id,
                shop_id=shop_id,
                deduct_quantity=spoken_qty
            )
            final_qty = max(0.0, existing_qty - spoken_qty)
            ai_msg = f"Kharab item recorded! '{matched_name}' ka stock {existing_qty} se घटकर {final_qty} {unit} kar diya."

        elif action_type == "CORRECTION":
            updated_item = await update_product_stock(
                product_id=item_id,
                shop_id=shop_id,
                new_quantity=spoken_qty,
                selling_price=selling_price if selling_price > 0 else None
            )
            final_qty = spoken_qty
            ai_msg = f"Ginti correct hogayi! '{matched_name}' ab {final_qty} {unit} updated hai."

        else: # RESTOCK (Default)
            updated_item = await update_product_stock(
                product_id=item_id,
                shop_id=shop_id,
                add_quantity=spoken_qty,
                selling_price=selling_price if selling_price > 0 else None
            )
            final_qty = existing_qty + spoken_qty
            ai_msg = f"Maal Aaya Done! '{matched_name}' stock {existing_qty} se badhkar {final_qty} {unit} ho gaya."

        return {
            "case": 2,
            "status": f"REPEAT_PRODUCT_{action_type}_UPDATED",
            "action_type": action_type,
            "is_existing": True,
            "ai_response": ai_msg,
            "product": updated_item or {
                "id": item_id,
                "name": matched_name,
                "quantity": final_qty,
                "unit": unit,
                "selling_price": selling_price
            }
        }

    # Sub-Case 2B: NEW PRODUCT -> SAVE DIRECTLY TO SUPABASE DB
    initial_stock = 0.0 if action_type == "SALE" else spoken_qty
    new_product_record = {
        "shop_id": shop_id,
        "name": candidate_name,
        "brand": ocr_result.get("brand", ""),
        "category": ocr_result.get("category", "General"),
        "selling_price": selling_price,
        "quantity": initial_stock,
        "unit": unit,
        "is_loose": is_loose,
        "price_unit": price_unit,
        "expiry_date": expiry_date,
        "barcode": barcode or (barcode_result.get("barcode") if barcode_result else None),
        "visual_embedding": image_embedding
    }

    saved_item = await save_product_to_shop_memory(shop_id, new_product_record)

    price_str = f"₹{selling_price}/kg" if is_loose else f"₹{selling_price}/{unit}"
    ai_msg = f"Done! Saved '{candidate_name}' ({price_str}) with stock {initial_stock} {unit}s to your shop inventory."

    return {
        "case": 2,
        "status": "NEW_PRODUCT_SAVED_DIRECT",
        "action_type": action_type,
        "is_existing": False,
        "ai_response": ai_msg,
        "product": saved_item or new_product_record
    }
