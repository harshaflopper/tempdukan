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
        Parse the following spoken voice note (in Hindi/Hinglish/English) into structured product details and action type:
        "{transcript}"

        Task:
        1. Determine the ACTION TYPE intended by the shopkeeper:
           - "SALE" if words mean selling to customer (e.g. becha, sold, diya, nikala, bik gaya, customer ko diya).
           - "RESTOCK" if words mean new stock received/purchased (e.g. aaya, bought, khareeda, stock aaya, unpacked).
           - "DAMAGE" if words mean broken/spoiled/expired item (e.g. kharab, toot gaya, rats, expired, damage).
           - "CORRECTION" if words mean physical count audit or remaining count (e.g. ginti, count, bacha hai, sirf 18 hai, dukaan me 10 hai).
           - If unclear, return "AUTO".

        2. Extract quantity and convert units (convert grams to kg e.g. 750 gram = 0.75 kg, 250 gram = 0.25 kg, 500 gram = 0.5 kg).
           Convert Hindi numbers: ek=1, do=2, teen=3, char=4, paanch=5, chhe=6, saat=7, aath=8, nau=9, das=10, bis=20, pachas=50, sau=100.

        Extract into JSON format:
        {{
          "action_type": "SALE" | "RESTOCK" | "DAMAGE" | "CORRECTION" | "AUTO",
          "product_name": "Product name if mentioned (e.g. Tic-Tac, Aata, Basmati Chawal)",
          "is_loose": boolean (true if loose grains/flour/pulses/sugar, false if packaged),
          "quantity": float number of units or kg (e.g. 3, 0.75, 10),
          "unit": "kg/gram/packet/box/piece/bottle/unit",
          "selling_price": float price if mentioned,
          "price_unit": "per_kg" or "per_item",
          "expiry_date": "expiry string if mentioned (e.g. August 2027, Dec 2026)"
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
                                # Merge with regex fallback if fields missing
                                action = parsed.get("action_type") or regex_data.get("action_type") or "AUTO"
                                qty = float(parsed.get("quantity") or regex_data.get("quantity") or 1.0)
                                unit = parsed.get("unit") or regex_data.get("unit") or "packet"
                                if unit.lower() in ("gram", "grams", "gm", "g") and qty >= 1.0:
                                    qty = qty / 1000.0
                                    unit = "kg"

                                return {
                                    "action_type": action,
                                    "product_name": parsed.get("product_name") or regex_data.get("product_name"),
                                    "is_loose": parsed.get("is_loose", regex_data.get("is_loose", False)),
                                    "quantity": qty,
                                    "unit": unit,
                                    "selling_price": float(parsed.get("selling_price") or regex_data.get("selling_price") or 0.0),
                                    "price_unit": parsed.get("price_unit") or regex_data.get("price_unit") or "per_item",
                                    "expiry_date": parsed.get("expiry_date") or regex_data.get("expiry_date") or ""
                                }
                except Exception as e:
                    print(f"Gemini {model} voice parsing notice: {e}")

    return regex_data

def fallback_regex_parse(transcript: str) -> Dict[str, Any]:
    result = {
        "action_type": "AUTO",
        "is_loose": False,
        "price_unit": "per_item",
        "quantity": 1.0,
        "unit": "packet",
        "selling_price": 0.0,
        "expiry_date": ""
    }
    
    if not transcript:
        return result

    # 1. Action Type Regex
    if re.search(r'\b(becha|sold|diya|nikala|bik|sale)\b', transcript, re.IGNORECASE):
        result["action_type"] = "SALE"
    elif re.search(r'\b(aaya|bought|stock|khareeda|unloaded|bhaara)\b', transcript, re.IGNORECASE):
        result["action_type"] = "RESTOCK"
    elif re.search(r'\b(kharab|toot|damage|expired|loss|wastage)\b', transcript, re.IGNORECASE):
        result["action_type"] = "DAMAGE"
    elif re.search(r'\b(ginti|count|bacha|sirf|total)\b', transcript, re.IGNORECASE):
        result["action_type"] = "CORRECTION"

    # 2. Check for loose items
    if re.search(r'\b(loose|khulla|khula|kilo|kg|gram)\b', transcript, re.IGNORECASE):
        result["is_loose"] = True
        result["unit"] = "kg"

    # 3. Grams to Kg conversion
    gram_match = re.search(r'(\d+)\s*(?:gram|grams|gm|g)\b', transcript, re.IGNORECASE)
    if gram_match:
        result["quantity"] = float(gram_match.group(1)) / 1000.0
        result["unit"] = "kg"
        result["is_loose"] = True
    else:
        # Standard quantity match
        qty_match = re.search(r'(\d+(?:\.\d+)?)\s*(unit|units|packet|packets|pc|pcs|piece|pieces|box|boxes|dibba|kg|kilo)', transcript, re.IGNORECASE)
        if qty_match:
            result["quantity"] = float(qty_match.group(1))
            result["unit"] = qty_match.group(2).lower()

    # 4. Price match
    price_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:rupees|rupe|rs|inr|kilo|per kg|\/kg)', transcript, re.IGNORECASE) or \
                  re.search(r'(?:rs|rupees|price|rate)\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE)
    if price_match:
        result["selling_price"] = float(price_match.group(1))

    # 5. Expiry match
    expiry_match = re.search(r'(?:expiry|expires|exp|expirated)\s*([a-zA-Z]+\s*\d{4}|\d{2}/\d{4}|\d{4})', transcript, re.IGNORECASE) or \
                   re.search(r'([a-zA-Z]+\s*20\d{2})', transcript, re.IGNORECASE)
    if expiry_match:
        result["expiry_date"] = expiry_match.group(1).strip()

    # 6. Product name match at beginning
    name_match = re.search(r'^(?:add|put|store|becha|aaya|kharab)?\s*([a-zA-Z0-9\s\-]+?)(?=\s*\d+|\s*unit|\s*rupee|\s*exp|\s*$)', transcript, re.IGNORECASE)
    if name_match:
        name = name_match.group(1).strip()
        if len(name) > 2 and name.lower() not in ('add', 'put', 'store', 'snap', 'becha', 'aaya', 'kharab'):
            result["product_name"] = name

    return result
