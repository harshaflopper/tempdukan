import httpx
import json
import re
from config import settings
from typing import Dict, Any, Optional, List
from db import get_supabase

async def process_voice_audio(
    audio_bytes: bytes,
    filename: str = "voice.webm",
    shop_id: str = settings.DEFAULT_SHOP_ID
) -> Dict[str, Any]:
    """
    1. Transcribes voice audio using Groq Whisper API (whisper-large-v3-turbo).
    2. Uses Gemini 2.5/3.5 Flash LLM to parse speech against shop inventory catalog.
    """
    transcript = ""

    # 1. Transcribe Audio via Groq Whisper API (whisper-large-v3-turbo)
    if settings.GROQ_API_KEY:
        try:
            url = "https://api.groq.com/openai/v1/audio/transcriptions"
            headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
            files = {"file": (filename, audio_bytes, "audio/webm")}
            data = {"model": "whisper-large-v3-turbo", "language": "hi"}
            
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, headers=headers, files=files, data=data)
                if res.status_code == 200:
                    transcript = res.json().get("text", "")
                    print(f"Groq Whisper Transcript: {transcript}")
                else:
                    print(f"Groq API Returned Status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"Groq Whisper API Exception: {e}")

    # 2. Extract structured details from transcript using Gemini 2.5 Flash LLM
    extracted_data = await parse_transcript_with_gemini(transcript, shop_id=shop_id)
    extracted_data["raw_transcript"] = transcript
    return extracted_data

async def get_inventory_catalog_for_prompt(shop_id: str) -> str:
    """
    Fetches shop inventory items from Supabase to feed into LLM prompt.
    """
    supabase = get_supabase()
    if not supabase:
        return "- Maggi (₹14/packet)\n- Parle-G (₹10/packet)\n- Sugar (₹42/kg)\n- Fortune Oil (₹135/liter)"

    try:
        res = supabase.table("products").select("name,selling_price,unit,quantity").eq("shop_id", shop_id).execute()
        if res.data and len(res.data) > 0:
            lines = [f"- {p['name']}: ₹{p.get('selling_price',0)}/{p.get('unit','packet')} (Stock: {p.get('quantity',0)})" for p in res.data]
            return "\n".join(lines)
    except Exception as e:
        print(f"Error fetching inventory for LLM prompt: {e}")

    return "- Maggi (₹14/packet)\n- Parle-G (₹10/packet)\n- Sugar (₹42/kg)"

async def parse_transcript_with_gemini(transcript: str, shop_id: str = settings.DEFAULT_SHOP_ID) -> Dict[str, Any]:
    """
    Passes voice transcript to Gemini Flash LLM alongside the shop's actual Inventory Catalog.
    Extracts Customer Name, Products matched to inventory, Discount, Udhaar Amount, and Quantities.
    """
    if not transcript:
        return {}

    regex_data = fallback_regex_parse(transcript)
    inventory_catalog_text = await get_inventory_catalog_for_prompt(shop_id)

    if settings.GEMINI_API_KEY:
        models_to_try = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-1.5-flash"
        ]
        
        prompt = f"""
        You are an intelligent AI assistant for an Indian Kirana Dukandar (shopkeeper).
        Your task is to parse a natural language voice/text note (spoken in Hindi/Hinglish/English):
        "{transcript}"

        Available Shop Inventory Catalog:
        {inventory_catalog_text}

        Rules:
        1. Match spoken items STRICTLY against the Shop Inventory Catalog above.
           Example: Spoken "20 packet Maggi" -> product_name: "Maggi", quantity: 20, unit: "packet".
           Example: Spoken "2 packet Parle-G" -> product_name: "Parle-G", quantity: 2, unit: "packet".

        2. Customer & Udhaar & Discount Detection:
           - Extract customer_name if mentioned (e.g., "Ravi ji" -> "Ravi", "Suresh bhaiya" -> "Suresh").
           - Extract customer_phone if spoken (10-digit phone number).
           - Extract udhaar_amount if spoken (e.g., "250 udhar", "udhar 250 rakho", "baaki account me daalo" -> udhaar_amount: 250.0). Set is_udhaar = true if udhaar is mentioned.
           - Extract discount_amount if spoken (e.g., "50 rupees discount", "20 kam kar do" -> discount_amount: 50.0).

        3. Action Type:
           - "BILL" or "SALE" if customer buying items (e.g., "Ravi ji 20 packet Maggi 2 Parle-G").
           - "UDHAAR_PAYMENT" if customer paying back debt (e.g., "Ravi paid 500 rupees").
           - "RESTOCK" if new stock received.
           - "DAMAGE" if broken/expired item.

        Return ONLY a JSON object:
        {{
          "action_type": "BILL" | "UDHAAR_PAYMENT" | "RESTOCK" | "DAMAGE" | "AUTO",
          "customer_name": "Customer Name or null",
          "customer_phone": "10 digit phone string or null",
          "is_udhaar": boolean,
          "udhaar_amount": float or null,
          "discount_amount": float or null,
          "udhaar_payment_amount": float if UDHAAR_PAYMENT else null,
          "items": [
             {{
               "product_name": "Matched Inventory Item Name",
               "quantity": float,
               "unit": "packet/kg/piece/liter/box",
               "selling_price": float or null
             }}
          ]
        }}
        Return raw valid JSON only without markdown formatting.
        """

        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }

        async with httpx.AsyncClient(timeout=6.0) as client:
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

                                action = parsed.get("action_type") or regex_data.get("action_type") or "AUTO"
                                items = parsed.get("items") or regex_data.get("items") or []

                                cleaned_items = []
                                for it in items:
                                    qty = float(it.get("quantity") or 1.0)
                                    unit = it.get("unit") or "packet"
                                    if unit.lower() in ("gram", "grams", "gm", "g") and qty >= 1.0:
                                        qty = qty / 1000.0
                                        unit = "kg"
                                    cleaned_items.append({
                                        "product_name": it.get("product_name") or "Item",
                                        "quantity": qty,
                                        "unit": unit,
                                        "selling_price": float(it.get("selling_price")) if it.get("selling_price") else None
                                    })

                                return {
                                    "action_type": action,
                                    "customer_name": parsed.get("customer_name") or regex_data.get("customer_name"),
                                    "customer_phone": parsed.get("customer_phone") or regex_data.get("customer_phone"),
                                    "is_udhaar": bool(parsed.get("is_udhaar") or (parsed.get("udhaar_amount") and float(parsed.get("udhaar_amount")) > 0) or regex_data.get("is_udhaar", False)),
                                    "udhaar_amount": float(parsed["udhaar_amount"]) if parsed.get("udhaar_amount") is not None else None,
                                    "discount_amount": float(parsed["discount_amount"]) if parsed.get("discount_amount") is not None else None,
                                    "udhaar_payment_amount": float(parsed["udhaar_payment_amount"]) if parsed.get("udhaar_payment_amount") is not None else regex_data.get("udhaar_payment_amount"),
                                    "items": cleaned_items,
                                    "product_name": cleaned_items[0]["product_name"] if cleaned_items else regex_data.get("product_name"),
                                    "quantity": cleaned_items[0]["quantity"] if cleaned_items else 1.0,
                                    "unit": cleaned_items[0]["unit"] if cleaned_items else "packet"
                                }
                except Exception as e:
                    print(f"Gemini {model} voice parsing notice: {e}")

    return regex_data

def fallback_regex_parse(transcript: str) -> Dict[str, Any]:
    result = {
        "action_type": "AUTO",
        "customer_name": None,
        "customer_phone": None,
        "is_udhaar": False,
        "udhaar_amount": None,
        "discount_amount": None,
        "udhaar_payment_amount": None,
        "items": [],
        "quantity": 1.0,
        "unit": "packet",
        "selling_price": 0.0
    }
    
    if not transcript:
        return result

    # Udhaar Payment Regex ("Ravi paid 500", "Ravi 500 jama kiya")
    pay_match = re.search(r'([a-zA-Z]+)\s*(?:paid|jama|diye|gave)\s*(?:rs|rupees|₹)?\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE) or \
                re.search(r'([a-zA-Z]+)\s*ne\s*(?:rs|rupees|₹)?\s*(\d+(?:\.\d+)?)\s*(?:paid|jama|diye)', transcript, re.IGNORECASE)
    if pay_match:
        result["action_type"] = "UDHAAR_PAYMENT"
        result["customer_name"] = pay_match.group(1).capitalize()
        result["udhaar_payment_amount"] = float(pay_match.group(2))
        return result

    # Customer Name Match at beginning ("Ravi took...", "Ravi 2 Maggi...", "Ravi ji...")
    cust_match = re.search(r'^(?:customer\s+)?([a-zA-Z]+)(?:\s+ji|\s+bhaiya)?\s+(?:took|le\s+gaya|diya|chahiye|ne|ka|\d+)', transcript, re.IGNORECASE)
    if cust_match:
        c_name = cust_match.group(1).capitalize()
        if c_name.lower() not in ('add', 'put', 'store', 'snap', 'becha', 'aaya', 'kharab', 'bill'):
            result["customer_name"] = c_name

    # Check for Udhaar intent / amount
    udh_match = re.search(r'(?:udhaar|baaki|khata)\s*(?:me|par)?\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE)
    if udh_match:
        result["is_udhaar"] = True
        result["udhaar_amount"] = float(udh_match.group(1))
    elif re.search(r'\b(udhaar|khata|baaki|bahi|later)\b', transcript, re.IGNORECASE):
        result["is_udhaar"] = True

    # Check for Discount intent / amount
    disc_match = re.search(r'(?:discount|off|kam)\s*(?:rs|rupees|₹)?\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE)
    if disc_match:
        result["discount_amount"] = float(disc_match.group(1))

    # Action Type Regex
    if re.search(r'\b(becha|sold|diya|nikala|bik|sale|took|bill)\b', transcript, re.IGNORECASE):
        result["action_type"] = "BILL"
    elif re.search(r'\b(aaya|bought|stock|khareeda|unloaded|bhaara)\b', transcript, re.IGNORECASE):
        result["action_type"] = "RESTOCK"

    # Extract Product & Qty
    is_loose = False
    if re.search(r'\b(loose|khulla|khula|kilo|kg|gram)\b', transcript, re.IGNORECASE):
        is_loose = True

    qty = 1.0
    unit = "kg" if is_loose else "packet"

    gram_match = re.search(r'(\d+)\s*(?:gram|grams|gm|g)\b', transcript, re.IGNORECASE)
    if gram_match:
        qty = float(gram_match.group(1)) / 1000.0
        unit = "kg"
    else:
        qty_match = re.search(r'(\d+(?:\.\d+)?)\s*(unit|units|packet|packets|pc|pcs|piece|pieces|box|boxes|dibba|kg|kilo)', transcript, re.IGNORECASE)
        if qty_match:
            qty = float(qty_match.group(1))
            unit = qty_match.group(2).lower()

    name_match = re.search(r'(?:took|becha|aaya|kharab|add)?\s*([a-zA-Z0-9\s\-]+?)(?=\s*\d+|\s*unit|\s*rupee|\s*exp|\s*$)', transcript, re.IGNORECASE)
    prod_name = "Item"
    if name_match:
        name = name_match.group(1).strip()
        if len(name) > 2 and name.lower() not in ('add', 'put', 'store', 'snap', 'becha', 'aaya', 'kharab', 'bill', 'ravi', 'customer'):
            prod_name = name

    result["quantity"] = qty
    result["unit"] = unit
    result["product_name"] = prod_name
    result["items"] = [{"product_name": prod_name, "quantity": qty, "unit": unit}]

    return result
