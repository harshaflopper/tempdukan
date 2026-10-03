import httpx
import json
import re
from config import settings
from typing import Dict, Any, Optional

async def process_voice_audio(audio_bytes: bytes, filename: str = "voice.webm") -> Dict[str, Any]:
    """
    1. Transcribes voice audio using Groq Whisper API (whisper-large-v3-turbo).
    2. Uses Gemini 2.5 Flash / 3.5 Flash LLM to parse Hindi/Hinglish/English speech into JSON.
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
    extracted_data = await parse_transcript_with_gemini(transcript)
    extracted_data["raw_transcript"] = transcript
    return extracted_data

async def parse_transcript_with_gemini(transcript: str) -> Dict[str, Any]:
    """
    Passes voice transcript to Gemini 2.5/3.5 Flash LLM for Kirana NLU entity extraction.
    Always merges with fallback_regex_parse to guarantee entity extraction.
    """
    if not transcript:
        return {}

    regex_data = fallback_regex_parse(transcript)

    if settings.GEMINI_API_KEY:
        models_to_try = [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-1.5-flash"
        ]
        
        prompt = f"""
        You are an AI assistant for an Indian Kirana shopkeeper (Dukandar).
        Parse the following spoken voice note (in Hindi/Hinglish/English) into structured billing details, customer name, udhaar, and product items:
        "{transcript}"

        Task:
        1. Determine the ACTION TYPE intended by the shopkeeper:
           - "BILL" or "SALE" if customer is buying items (e.g., "Ravi took 2 Maggi", "3 Maggi becha", "Tic Tac 2 piece").
           - "UDHAAR_PAYMENT" if customer is paying back debt (e.g., "Ravi paid ₹500", "Ravi ne ₹500 jama kiya", "Ravi 500 rupees paid").
           - "RESTOCK" if new stock received (e.g. aaya, bought, stock in).
           - "DAMAGE" if broken/expired item (e.g. kharab, toot gaya).
           - "CORRECTION" if physical audit (e.g. ginti, count, bacha hai).

        2. Customer & Udhaar Detection:
           - Extract customer_name if mentioned (e.g. Ravi, Suresh, Amit, Sharmaji).
           - Extract customer_phone if 10-digit number is spoken.
           - Set is_udhaar = true if words like "udhaar", "khata", "baaki", "bahi khata", "later" are spoken.
           - Extract udhaar_payment_amount if action is UDHAAR_PAYMENT (e.g., 500.0).

        3. Extract all product items mentioned:
           - Convert grams to kg (750 gram = 0.75 kg, 500 gram = 0.5 kg, 250 gram = 0.25 kg).
           - Convert Hindi numbers: ek=1, do=2, teen=3, char=4, paanch=5, chhe=6, saat=7, aath=8, nau=9, das=10, bis=20, pachas=50, sau=100.

        Extract into JSON format:
        {{
          "action_type": "BILL" | "UDHAAR_PAYMENT" | "RESTOCK" | "DAMAGE" | "CORRECTION" | "AUTO",
          "customer_name": "Customer Name or null",
          "customer_phone": "Phone number or null",
          "is_udhaar": boolean,
          "udhaar_payment_amount": float amount if UDHAAR_PAYMENT else null,
          "items": [
             {{
               "product_name": "Product Name (e.g. Maggi, Sugar, Tic Tac)",
               "quantity": float (e.g. 2, 0.5, 1),
               "unit": "packet/kg/piece/box/bottle",
               "selling_price": float custom price if spoken or null
             }}
          ]
        }}
        Return ONLY raw valid JSON, no markdown formatting.
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

                                # Ensure item units & quantities clean
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
                                    "is_udhaar": bool(parsed.get("is_udhaar", regex_data.get("is_udhaar", False))),
                                    "udhaar_payment_amount": float(parsed.get("udhaar_payment_amount")) if parsed.get("udhaar_payment_amount") else regex_data.get("udhaar_payment_amount"),
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
        "udhaar_payment_amount": None,
        "items": [],
        "quantity": 1.0,
        "unit": "packet",
        "selling_price": 0.0
    }
    
    if not transcript:
        return result

    # 1. Udhaar Payment Regex ("Ravi paid 500", "Ravi 500 jama kiya")
    pay_match = re.search(r'([a-zA-Z]+)\s*(?:paid|jama|diye|gave)\s*(?:rs|rupees|₹)?\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE) or \
                re.search(r'([a-zA-Z]+)\s*ne\s*(?:rs|rupees|₹)?\s*(\d+(?:\.\d+)?)\s*(?:paid|jama|diye)', transcript, re.IGNORECASE)
    if pay_match:
        result["action_type"] = "UDHAAR_PAYMENT"
        result["customer_name"] = pay_match.group(1).capitalize()
        result["udhaar_payment_amount"] = float(pay_match.group(2))
        return result

    # 2. Customer Name Match at beginning ("Ravi took...", "Ravi 2 Maggi...")
    cust_match = re.search(r'^(?:customer\s+)?([a-zA-Z]+)\s+(?:took|le\s+gaya|diya|chahiye|ne|ka)', transcript, re.IGNORECASE)
    if cust_match:
        c_name = cust_match.group(1).capitalize()
        if c_name.lower() not in ('add', 'put', 'store', 'snap', 'becha', 'aaya', 'kharab', 'bill'):
            result["customer_name"] = c_name

    # 3. Check for Udhaar intent
    if re.search(r'\b(udhaar|khata|baaki|bahi|later)\b', transcript, re.IGNORECASE):
        result["is_udhaar"] = True

    # 4. Action Type Regex
    if re.search(r'\b(becha|sold|diya|nikala|bik|sale|took|bill)\b', transcript, re.IGNORECASE):
        result["action_type"] = "BILL"
    elif re.search(r'\b(aaya|bought|stock|khareeda|unloaded|bhaara)\b', transcript, re.IGNORECASE):
        result["action_type"] = "RESTOCK"
    elif re.search(r'\b(kharab|toot|damage|expired|loss|wastage)\b', transcript, re.IGNORECASE):
        result["action_type"] = "DAMAGE"
    elif re.search(r'\b(ginti|count|bacha|sirf|total)\b', transcript, re.IGNORECASE):
        result["action_type"] = "CORRECTION"

    # 5. Extract Product & Qty
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
