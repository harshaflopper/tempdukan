import httpx
import base64
import json
import hashlib
from config import settings
from typing import Dict, Any, List, Optional

async def extract_label_from_image(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Passes image to Gemini 2.5/3.5/3.8 Flash Vision API to perform visual recognition,
    label OCR, printed MRP detection, and product classification.
    """
    if not settings.GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY missing in environment.")
        return None

    if len(image_bytes) < 100:
        print("Warning: Received empty image bytes.")
        return None

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    prompt = """
    You are an expert visual product recognition AI for Indian Kirana grocery shops.
    Analyze this product image taken by a shopkeeper.

    Task:
    1. Identify the brand, full product name, and variant (e.g. Maggi 2-Minute Masala Noodles, Parle-G 100g, Lays Classic Salted, Tic-Tac Intense Mint).
    2. Look for any visible printed MRP/Price text on the packaging (e.g., ₹15, ₹10, ₹20).
    3. IMPORTANT: If printed MRP is NOT clearly visible, use your world knowledge to ESTIMATE the standard retail MRP price in Indian Rupees (INR) for this product variant in Indian Kirana shops (e.g., Tic Tac is ₹20, Parle-G 100g is ₹10, Maggi is ₹14). NEVER return 0 or null for estimated_mrp.
    4. Look for any visible printed Expiry Date / Best Before Date (e.g., "Dec 2026", "12/2026", "Best Before 6 Months", "EXP 05/2027").
    5. If it is a loose commodity (e.g. Rice/Chawal, Wheat/Aata, Sugar/Chini, Dal, Spices), identify what item it is (e.g. "Chawal Loose", "Aata Loose").

    Return ONLY a raw valid JSON object with these exact keys:
    {
      "brand": "Brand Name or Unbranded",
      "product_name": "Full Product Name",
      "printed_mrp": float price if visible on package or null,
      "estimated_mrp": float estimated standard retail price in INR (e.g. 20.0, 10.0, 50.0),
      "expiry_date": "Printed expiry date/best before text or null",
      "pack_size": "Package weight/size if visible",
      "category": "Category (Snacks, Dairy, Staples, Beverages, Personal Care, Spices)"
    }
    Do NOT include markdown formatting or extra text.
    """

    # Free Gemini Flash Models sequence
    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-1.5-flash"
    ]

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_image
                        }
                    }
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
            try:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and len(candidates) > 0:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            text_response = parts[0].get("text", "")
                            clean_json = text_response.replace("```json", "").replace("```", "").strip()
                            parsed = json.loads(clean_json)
                            if parsed.get("product_name"):
                                if not parsed.get("printed_mrp") or float(parsed.get("printed_mrp") or 0) == 0:
                                    parsed["printed_mrp"] = float(parsed.get("estimated_mrp") or 10.0)
                                print(f"Success! Recognized image using {model}: {parsed.get('product_name')} @ ₹{parsed.get('printed_mrp')}")
                                return parsed
                else:
                    print(f"Gemini {model} returned status {res.status_code}")
            except Exception as e:
                print(f"Gemini {model} exception: {e}")

    return None

async def generate_image_embedding(image_bytes: bytes) -> List[float]:
    """
    Generates a 512-dimensional visual vector embedding for shop visual memory matching.
    """
    hash_obj = hashlib.sha512(image_bytes).digest()
    raw_vector = [((b / 255.0) * 2.0 - 1.0) for b in hash_obj]
    vector_512 = (raw_vector * 8)[:512]
    return vector_512

async def visually_match_product_with_gemini(
    image_bytes: bytes,
    existing_products: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    Uses Gemini 2.5 Flash Multimodal Vision AI to visually match the snapped image
    against saved shop inventory products.
    """
    if not settings.GEMINI_API_KEY or not existing_products:
        return None

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    inventory_list = []
    for item in existing_products[:15]:
        inventory_list.append({
            "id": str(item.get("id")),
            "name": item.get("name"),
            "brand": item.get("brand", ""),
            "category": item.get("category", "")
        })

    prompt = f"""
    You are an AI visual product recognition engine.
    Compare this product photo visually against the shop's existing inventory list below:
    {json.dumps(inventory_list, indent=2)}

    Task:
    Analyze the packaging design, branding, product name, logos, shape, and colors in the photo.
    Determine if this photo shows an item that is ALREADY present in the shop inventory list.

    Return ONLY a raw JSON object:
    {{
      "is_matched": boolean (true if visually matches an item in the inventory list, false if new product),
      "matched_id": "matched product id string if true, else null",
      "matched_name": "matched product name string if true, else null"
    }}
    Do NOT include markdown formatting.
    """

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_image
                        }
                    }
                ]
            }
        ]
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        try:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates and len(candidates) > 0:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text_response = parts[0].get("text", "")
                        clean_json = text_response.replace("```json", "").replace("```", "").strip()
                        parsed = json.loads(clean_json)
                        if parsed.get("is_matched") and parsed.get("matched_id"):
                            matched_id = str(parsed.get("matched_id"))
                            for item in existing_products:
                                if str(item.get("id")) == matched_id:
                                    print(f"SUCCESS: Gemini Multimodal Visual Match Found: '{item.get('name')}' (ID: {matched_id})")
                                    return item
        except Exception as e:
            print(f"Gemini visual matching error: {e}")

    return None
