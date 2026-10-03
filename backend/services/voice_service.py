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
        Parse the following spoken voice note (in Hindi/Hinglish/English) into structured product details:
        "{transcript}"

        Extract into JSON format:
        {{
          "product_name": "Product name if mentioned (e.g. Tic-Tac, Aata Loose, Basmati Chawal)",
          "is_loose": boolean (true if loose grains/flour/pulses/sugar, false if packaged),
          "quantity": float number of units/kg (convert Hindi: das=10, bis=20, pachas=50, sau=100, ek=1),
          "unit": "kg/gram/packet/box/piece/bottle/unit",
          "selling_price": float price (e.g. 20, 40, 10),
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
                                return {
                                    "product_name": parsed.get("product_name") or regex_data.get("product_name"),
                                    "is_loose": parsed.get("is_loose", regex_data.get("is_loose", False)),
                                    "quantity": float(parsed.get("quantity") or regex_data.get("quantity") or 1.0),
                                    "unit": parsed.get("unit") or regex_data.get("unit") or "packet",
                                    "selling_price": float(parsed.get("selling_price") or regex_data.get("selling_price") or 0.0),
                                    "price_unit": parsed.get("price_unit") or regex_data.get("price_unit") or "per_item",
                                    "expiry_date": parsed.get("expiry_date") or regex_data.get("expiry_date") or ""
                                }
                except Exception as e:
                    print(f"Gemini {model} voice parsing notice: {e}")

    return regex_data

def fallback_regex_parse(transcript: str) -> Dict[str, Any]:
    result = {"is_loose": False, "price_unit": "per_item", "quantity": 1.0, "unit": "packet", "selling_price": 0.0, "expiry_date": ""}
    
    if not transcript:
        return result

    # Check for loose items
    if re.search(r'\b(loose|khulla|khula|kilo|kg)\b', transcript, re.IGNORECASE):
        result["is_loose"] = True
        result["unit"] = "kg"

    # Price match (e.g. 20 rupees, 20 rupe, rs 20, 20 INR)
    price_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:rupees|rupe|rs|inr|kilo|per kg|\/kg)', transcript, re.IGNORECASE) or \
                  re.search(r'(?:rs|rupees|price|rate)\s*(\d+(?:\.\d+)?)', transcript, re.IGNORECASE)
    if price_match:
        result["selling_price"] = float(price_match.group(1))

    # Quantity match (e.g. 10 units, 10 box, 10 packets, 10 pcs)
    qty_match = re.search(r'(\d+)\s*(unit|units|packet|packets|pc|pcs|piece|pieces|box|boxes|dibba|kg|kilo)', transcript, re.IGNORECASE)
    if qty_match:
        result["quantity"] = float(qty_match.group(1))
        result["unit"] = qty_match.group(2).lower()

    # Expiry match (e.g. expirated August 2027, exp Dec 2026, expiry 2027, 08/2027)
    expiry_match = re.search(r'(?:expiry|expires|exp|expirated)\s*([a-zA-Z]+\s*\d{4}|\d{2}/\d{4}|\d{4})', transcript, re.IGNORECASE) or \
                   re.search(r'([a-zA-Z]+\s*20\d{2})', transcript, re.IGNORECASE)
    if expiry_match:
        result["expiry_date"] = expiry_match.group(1).strip()

    # Product name match at beginning (e.g. Tic Tac ...)
    name_match = re.search(r'^(?:add|put|store)?\s*([a-zA-Z0-9\s\-]+?)(?=\s*\d+|\s*unit|\s*rupee|\s*exp|\s*$)', transcript, re.IGNORECASE)
    if name_match:
        name = name_match.group(1).strip()
        if len(name) > 2 and name.lower() not in ('add', 'put', 'store', 'snap'):
            result["product_name"] = name

    return result
