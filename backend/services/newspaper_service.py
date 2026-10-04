import re
import json
import httpx
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from config import settings
from db import get_supabase
from services.expiry_service import parse_expiry_days

REFERENCE_DATE = date(2026, 10, 4)

async def generate_daily_shop_newspaper(shop_id: str = 'SHOP001') -> Dict[str, Any]:
    """
    Generates a daily newspaper edition for the Dukandar containing 3-5 prioritized
    actionable stories: Expiry alerts, Fast movers, Slow movers/Dead stock, and Udhaar recovery.
    """
    supabase = get_supabase()
    products = []
    customers = []

    if supabase:
        try:
            res_p = supabase.table("products").select("*").eq("shop_id", shop_id).execute()
            products = res_p.data or []
        except Exception as e:
            print(f"Error reading products for newspaper: {e}")

        try:
            res_c = supabase.table("customers").select("*").eq("shop_id", shop_id).execute()
            customers = res_c.data or []
        except Exception as e:
            print(f"Error reading customers for newspaper: {e}")

    # Analyze Expiry & Stock Velocity
    expiring_items = []
    low_stock_items = []
    slow_moving_items = []

    for p in products:
        raw_exp = p.get("expiry_date")
        days_left, formatted_exp = parse_expiry_days(raw_exp)
        qty = float(p.get("quantity") or 0)
        price = float(p.get("selling_price") or 0)
        name = p.get("name", "Unknown Item")
        brand = p.get("brand", "")

        # Expiry Check
        if raw_exp and days_left <= 30:
            expiring_items.append({
                "id": p.get("id"),
                "name": name,
                "brand": brand,
                "quantity": qty,
                "unit": p.get("unit", "packet"),
                "selling_price": price,
                "expiry_date": formatted_exp,
                "days_left": days_left,
                "suggested_clearance_price": round(price * 0.75, 1) if days_left <= 7 else round(price * 0.85, 1)
            })

        # Low Stock / Fast Mover Check (Qty <= 5)
        if qty <= 5 and qty > 0:
            low_stock_items.append({
                "id": p.get("id"),
                "name": name,
                "quantity": qty,
                "unit": p.get("unit", "packet"),
                "selling_price": price
            })

        # Slow Moving / Dead Stock Check (Assuming products with high stock or marked slow)
        if qty >= 15:
            slow_moving_items.append({
                "id": p.get("id"),
                "name": name,
                "quantity": qty,
                "unit": p.get("unit", "packet"),
                "selling_price": price,
                "days_in_stock": 25
            })

    # Sort expiring by days left
    expiring_items.sort(key=lambda x: x["days_left"])

    # Analyze Udhaar Ledger (Top Debtors)
    top_udhaar_customers = []
    for c in customers:
        balance = float(c.get("udhaar_balance") or 0)
        if balance > 0:
            top_udhaar_customers.append({
                "id": c.get("id"),
                "name": c.get("name", "Customer"),
                "phone": c.get("phone", ""),
                "udhaar_balance": balance
            })
    top_udhaar_customers.sort(key=lambda x: x["udhaar_balance"], reverse=True)

    # Construct Newspaper Edition JSON Structure
    newspaper_data = {
        "edition_name": "दैनिक दुकान समाचार",
        "tagline": "LastDukan Daily Edition - SHOP001",
        "date_str": "रविवार, 4 अक्टूबर 2026",
        "shop_id": shop_id,
        "total_stories": 4,
        "stories": {
            "expiry_headline": _build_expiry_story(expiring_items),
            "fast_movers_headline": _build_fast_movers_story(low_stock_items),
            "slow_movers_headline": _build_slow_movers_story(slow_moving_items),
            "udhaar_headline": _build_udhaar_story(top_udhaar_customers)
        }
    }

    # Generate AI News Bulletin Audio Script & Refined Headlines using Gemini Flash
    if settings.GEMINI_API_KEY:
        ai_refined = await _refine_newspaper_with_gemini(shop_id, newspaper_data)
        if ai_refined:
            newspaper_data["stories"] = ai_refined.get("stories", newspaper_data["stories"])
            newspaper_data["bulletin_audio_script"] = ai_refined.get("bulletin_audio_script", _build_fallback_bulletin(newspaper_data))
        else:
            newspaper_data["bulletin_audio_script"] = _build_fallback_bulletin(newspaper_data)
    else:
        newspaper_data["bulletin_audio_script"] = _build_fallback_bulletin(newspaper_data)

    return newspaper_data

def _build_expiry_story(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {
            "category": "मुख्य समाचार",
            "title": "स्टॉक तरोताजा: कोई सामान जल्द expire नहीं हो रहा",
            "body": "आपकी दुकान का पूरा स्टॉक सुरक्षित है। सभी सामानों की एक्सपायरी डेट लंबी है।",
            "urgency": "SAFE",
            "items": []
        }
    critical_item = items[0]
    days = critical_item["days_left"]
    count = len(items)
    
    if days <= 0:
        title = f"सावधान: {critical_item['name']} Expire हो चुका है!"
        body = f"{critical_item['name']} और कुल {count} सामान एक्सपायर हो चुके हैं। इन्हें तुरंत शेल्फ से हटाएं।"
        urgency = "CRITICAL"
    elif days <= 7:
        title = f"मुख्य समाचार: {critical_item['name']} व {count} सामान इसी हफ्ते Expire हो रहे हैं"
        body = f"{critical_item['name']} की एक्सपायरी केवल {days} दिन में है। इसे दुकान के फ्रंट गल्ले पर रखें और ₹{critical_item['suggested_clearance_price']} में डिस्काउंट पर बेचें।"
        urgency = "CRITICAL"
    else:
        title = f"स्टॉक ख़बर: {count} सामान इस महीने Expire होने वाले हैं"
        body = f"{critical_item['name']} की एक्सपायरी {days} दिन में है। नियमित ग्राहकों को डिस्काउंट देकर पहले बेचें।"
        urgency = "WARNING"

    return {
        "category": "मुख्य समाचार",
        "title": title,
        "body": body,
        "urgency": urgency,
        "items": items[:3]
    }

def _build_fast_movers_story(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {
            "category": "बाज़ार हलचल",
            "title": "स्टॉक मात्रा पर्याप्त है",
            "body": "सभी मुख्य सामानों की मात्रा दुकान में पर्याप्त है।",
            "items": []
        }
    top_item = items[0]
    return {
        "category": "बाज़ार हलचल",
        "title": f"बंपर मांग: {top_item['name']} तेज़ी से बिक रहा है",
        "body": f"{top_item['name']} की मांग बहुत तेज़ है और दुकान में केवल {top_item['quantity']} {top_item['unit']} बचे हैं। नया स्टॉक ऑर्डर करें।",
        "items": items[:2]
    }

def _build_slow_movers_story(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not items:
        return {
            "category": "धीमी बिक्री चेतावनी",
            "title": "बिक्री चक्र सामान्य है",
            "body": "कोई भी सामान रुका हुआ नहीं है।",
            "items": []
        }
    slow_item = items[0]
    return {
        "category": "धीमी बिक्री चेतावनी",
        "title": f"धीमी गति: {slow_item['name']} की बिक्री थमी",
        "body": f"{slow_item['name']} की {slow_item['quantity']} यूनिट्स 20+ दिनों से रुकी हैं। सेल्समैन को वापस करें या नया ऑर्डर न दें।",
        "items": items[:2]
    }

def _build_udhaar_story(customers: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not customers:
        return {
            "category": "उधार वसूली",
            "title": "उधार खाता साफ़ है",
            "body": "किसी ग्राहक का भारी बकाया नहीं है।",
            "customers": []
        }
    top = customers[0]
    return {
        "category": "उधार वसूली",
        "title": f"उधार ख़बर: {top['name']} का ₹{top['udhaar_balance']} बकाया",
        "body": f"{top['name']} का बकाया ₹{top['udhaar_balance']} है। 1-टैप में SMS रिमाइंडर भेजें।",
        "customers": customers[:3]
    }

def _build_fallback_bulletin(data: Dict[str, Any]) -> str:
    s = data.get("stories", {})
    exp_title = s.get("expiry_headline", {}).get("title", "")
    fast_title = s.get("fast_movers_headline", {}).get("title", "")
    udh_title = s.get("udhaar_headline", {}).get("title", "")
    return f"नमस्कार रामजी! आज के दुकान समाचार की मुख्य बातें: {exp_title}। {fast_title}। {udh_title}। धन्यवाद!"

async def _refine_newspaper_with_gemini(shop_id: str, raw_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Calls Gemini Flash to generate authentic Hindi newspaper headlines and bulletined news audio script."""
    prompt = f"""
    You are the Chief Editor of 'दैनिक दुकान समाचार' (Daily Kirana Shop Newspaper) for Indian shopkeepers.
    Refine the following raw shop data into an engaging 4-headline local Indian newspaper front page format in Hindi/Hinglish.

    Raw Data:
    {json.dumps(raw_data, indent=2)}

    Requirements:
    1. Output ONLY a valid JSON object matching the exact structure below.
    2. Write natural, bold Hindi headlines and 2-sentence story bodies suitable for an Indian Kirana Dukandar.
    3. Include a "bulletin_audio_script" string that reads out all 4 news headlines smoothly in spoken Hindi news anchor style.

    Return JSON schema:
    {{
      "stories": {{
        "expiry_headline": {{
          "category": "मुख्य समाचार",
          "title": "Bold Hindi Expiry Headline",
          "body": "2 sentence clear story body in Hindi",
          "urgency": "CRITICAL" | "WARNING" | "SAFE",
          "items": [...]
        }},
        "fast_movers_headline": {{
          "category": "बाज़ार हलचल",
          "title": "Bold Fast Mover Headline in Hindi",
          "body": "2 sentence story body",
          "items": [...]
        }},
        "slow_movers_headline": {{
          "category": "धीमी बिक्री चेतावनी",
          "title": "Bold Slow Moving Warning Headline",
          "body": "2 sentence story body with Do-Not-Reorder advice",
          "items": [...]
        }},
        "udhaar_headline": {{
          "category": "उधार वसूली",
          "title": "Bold Udhaar Recovery Headline",
          "body": "2 sentence story body",
          "customers": [...]
        }}
      }},
      "bulletin_audio_script": "Full spoken Hindi news bulletin text to read out loud via TTS"
    }}
    Do NOT include markdown formatting or backticks.
    """

    models_to_try = ["gemini-2.5-flash", "gemini-3-flash", "gemini-1.5-flash"]
    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 2048}
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    candidates = resp_json.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
                        clean_json = re.sub(r'```json\s*|\s*```', '', text).strip()
                        return json.loads(clean_json)
        except Exception as e:
            print(f"Gemini error for daily newspaper: {e}")
            continue

    return None
