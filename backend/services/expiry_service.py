import re
import json
import httpx
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from config import settings
from db import get_supabase

# Reference date for calculations (Today: Oct 4, 2026)
REFERENCE_DATE = date(2026, 10, 4)

def parse_expiry_days(expiry_str: Optional[str]) -> Tuple[int, str]:
    """
    Parses various expiry date string formats and returns (days_remaining, formatted_date_str).
    Formats supported: YYYY-MM-DD, DD/MM/YYYY, MM/YYYY, Mon YYYY (e.g. Oct 2026), etc.
    """
    if not expiry_str or not isinstance(expiry_str, str) or not expiry_str.strip():
        return 999, "No Expiry Recorded"
    
    clean_str = expiry_str.strip()
    
    # Check YYYY-MM-DD
    match_iso = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', clean_str)
    if match_iso:
        try:
            dt = date(int(match_iso.group(1)), int(match_iso.group(2)), int(match_iso.group(3)))
            days = (dt - REFERENCE_DATE).days
            return days, dt.strftime("%d %b %Y")
        except ValueError:
            pass

    # Check DD/MM/YYYY or DD-MM-YYYY
    match_dmy = re.search(r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})', clean_str)
    if match_dmy:
        try:
            dt = date(int(match_dmy.group(3)), int(match_dmy.group(2)), int(match_dmy.group(1)))
            days = (dt - REFERENCE_DATE).days
            return days, dt.strftime("%d %b %Y")
        except ValueError:
            pass

    # Check MM/YYYY or MM-YYYY
    match_my = re.search(r'(\d{1,2})[/-](\d{4})', clean_str)
    if match_my:
        try:
            month = int(match_my.group(1))
            year = int(match_my.group(2))
            # Assume end of month
            if month in (1, 3, 5, 7, 8, 10, 12):
                day = 31
            elif month in (4, 6, 9, 11):
                day = 30
            else:
                day = 28
            dt = date(year, month, day)
            days = (dt - REFERENCE_DATE).days
            return days, dt.strftime("%b %Y")
        except ValueError:
            pass

    # Check Month Year text e.g. "Oct 2026", "December 2026"
    months_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    match_month_txt = re.search(r'([a-zA-Z]{3,9})\s+(\d{4})', clean_str)
    if match_month_txt:
        m_name = match_month_txt.group(1)[:3].lower()
        year = int(match_month_txt.group(2))
        if m_name in months_map:
            m_num = months_map[m_name]
            day = 31 if m_num in (1, 3, 5, 7, 8, 10, 12) else (30 if m_num in (4, 6, 9, 11) else 28)
            try:
                dt = date(year, m_num, day)
                days = (dt - REFERENCE_DATE).days
                return days, dt.strftime("%b %Y")
            except ValueError:
                pass

    # Default fallback if parsing fails
    return 30, clean_str

async def get_shop_expiry_analysis(shop_id: str = 'SHOP001') -> Dict[str, Any]:
    """
    Fetches shop products, analyzes expiry dates, categorizes risk levels,
    and calls Gemini AI Flash to generate clear, actionable clearance strategies.
    """
    supabase = get_supabase()
    products = []
    if supabase:
        try:
            res = supabase.table("products").select("*").eq("shop_id", shop_id).execute()
            products = res.data or []
        except Exception as e:
            print(f"Error reading products for expiry analysis: {e}")
            products = []

    if not products:
        return {
            "shop_id": shop_id,
            "status": "SAFE",
            "banner_message": "सभी प्रोडक्ट सुरक्षित हैं! कोई भी सामान जल्द expire नहीं हो रहा है।",
            "total_products": 0,
            "critical_count": 0,
            "soon_count": 0,
            "expired_count": 0,
            "expiring_products": []
        }

    analyzed_items = []
    critical_count = 0
    soon_count = 0
    expired_count = 0

    for p in products:
        raw_expiry = p.get("expiry_date")
        days_left, formatted_exp = parse_expiry_days(raw_expiry)
        
        # Categorize
        if days_left <= 0 and raw_expiry:
            risk_level = "EXPIRED"
            expired_count += 1
        elif days_left <= 7:
            risk_level = "CRITICAL"
            critical_count += 1
        elif days_left <= 30:
            risk_level = "SOON"
            soon_count += 1
        else:
            risk_level = "SAFE"

        if risk_level in ("EXPIRED", "CRITICAL", "SOON"):
            item_data = {
                "id": p.get("id"),
                "name": p.get("name", "Unknown Item"),
                "brand": p.get("brand", ""),
                "quantity": float(p.get("quantity") or 1.0),
                "unit": p.get("unit", "packet"),
                "selling_price": float(p.get("selling_price") or 10.0),
                "raw_expiry": raw_expiry,
                "formatted_expiry": formatted_exp,
                "days_left": days_left,
                "risk_level": risk_level,
                "total_value_at_risk": round(float(p.get("quantity") or 1.0) * float(p.get("selling_price") or 10.0), 2)
            }
            analyzed_items.append(item_data)

    # Sort by urgency (lowest days_left first)
    analyzed_items.sort(key=lambda x: x["days_left"])

    # Determine overall status & banner text
    if expired_count > 0:
        status = "CRITICAL"
        banner_message = f"🚨 {expired_count} सामान Expired हो चुके हैं और {critical_count} सामान इस हफ्ते Expire हो रहे हैं! तुरंत Action लें।"
    elif critical_count > 0:
        status = "CRITICAL"
        banner_message = f"⚠️ {critical_count} सामान अगले 7 दिनों में Expire होने वाले हैं! AI Clear Strategy देखें।"
    elif soon_count > 0:
        status = "WARNING"
        banner_message = f"🔔 {soon_count} सामान इस महीने Expire होने वाले हैं! बिक्री बढ़ाने की AI Strategy देखें।"
    else:
        status = "SAFE"
        banner_message = "✅ सभी प्रोडक्ट सुरक्षित हैं! कोई भी सामान जल्द expire नहीं हो रहा है।"

    # Generate AI Clearance Strategies using Gemini Flash if expiring items exist
    if analyzed_items and settings.GEMINI_API_KEY:
        ai_strategies = await _generate_gemini_expiry_strategies(shop_id, analyzed_items)
        # Merge AI strategies into item dictionary
        for item in analyzed_items:
            item_id = str(item.get("id"))
            if item_id in ai_strategies:
                item.update(ai_strategies[item_id])
            else:
                # Default fallback strategy generator if AI skips item
                item.update(_generate_rule_fallback_strategy(item))

    return {
        "shop_id": shop_id,
        "status": status,
        "banner_message": banner_message,
        "total_products": len(products),
        "critical_count": critical_count,
        "soon_count": soon_count,
        "expired_count": expired_count,
        "total_expiring_count": len(analyzed_items),
        "expiring_products": analyzed_items
    }

def _generate_rule_fallback_strategy(item: Dict[str, Any]) -> Dict[str, Any]:
    """Generates rule-based clearance strategy fallback."""
    days = item.get("days_left", 30)
    price = item.get("selling_price", 10.0)
    name = item.get("name", "Item")

    if days <= 0:
        return {
            "strategy_type": "REMOVE",
            "action_title": "शेल्फ से हटाएं",
            "recommended_action": f"{name} Expire हो चुका है! इसे तुरंत शेल्फ से हटाएं ताकि खराब सामान न बिके।",
            "suggested_price": 0.0,
            "combo_idea": "इसे बिक्री में न रखें",
            "spoken_summary": f"{name} Expire हो चुका है। कृपया इसे दुकान से हटा दें।"
        }
    elif days <= 7:
        suggested = round(price * 0.75, 1) # 25% discount
        return {
            "strategy_type": "FRONT_SHELF_DISCOUNT",
            "action_title": "फ्रंट शेल्फ + 25% छूट",
            "recommended_action": f"इन्हें दुकान के फ्रंट काउंटर / गल्ले के पास रखें और ₹{price} के बजाय ₹{suggested} (25% छूट) में बेचें।",
            "suggested_price": suggested,
            "combo_idea": f"₹300 से अधिक की खरीदारी पर 1 पीस मुफ़्त / कम कीमत में दें",
            "spoken_summary": f"{name} की एक्सपायारी केवल {days} दिन में है! इसे फ्रंट काउंटर पर रखकर ₹{suggested} में जल्दी बेचें।"
        }
    else:
        suggested = round(price * 0.85, 1) # 15% discount
        return {
            "strategy_type": "COMBO_FREEBIE",
            "action_title": "कॉम्बो ऑफर या उधार ग्राहक डील",
            "recommended_action": f"नियमित ग्राहकों को 15% डिस्काउंट पर ऑफर करें या 2 खरीदने पर 1 स्पेशल रेट दें।",
            "suggested_price": suggested,
            "combo_idea": f"Buy 2 Get 1 Free या बड़े बिल के साथ स्पेशल गिफ्ट कॉम्बिनेशन बनाएं",
            "spoken_summary": f"{name} इस महीने expire होगा। इसे नियमित ग्राहकों को थोड़ा डिस्काउंट देकर बेचें।"
        }

async def _generate_gemini_expiry_strategies(shop_id: str, items: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Calls Gemini Flash model to compute AI Clearance Strategies for all expiring items."""
    prompt = f"""
    You are an expert AI Kirana Sales & Inventory Clearance Consultant for Indian grocery stores.
    Analyze the following list of products that are expiring soon or expired in the shop:

    Products List:
    {json.dumps(items, indent=2)}

    Task:
    For EACH product ID in the list, create a smart, practical clearance strategy customized for Indian Dukandars.
    Strategize using these options:
    1. "FRONT_SHELF" - Place on front checkout counter / display shelf for fast impulse buying.
    2. "DISCOUNT" - Reduce price by 15% to 40% (suggest clear price in INR).
    3. "COMBO_FREEBIE" - Offer as freebie or discounted addon for big bills (e.g. "Free with ₹500 purchase").
    4. "UDHAAR_BULK" - Offer bulk clearance discount to regular Udhaar / Kirana customers.
    5. "REMOVE" - If expired (days_left <= 0), instruct immediate removal from shelf.

    Return ONLY a raw valid JSON dictionary where keys are the product IDs, mapping to objects with these EXACT keys:
    {{
      "product_id": {{
        "strategy_type": "FRONT_SHELF" | "DISCOUNT" | "COMBO_FREEBIE" | "UDHAAR_BULK" | "REMOVE",
        "action_title": "Short 3-4 word strategy title in Hindi/English",
        "recommended_action": "Clear actionable 1-2 sentence recommendation in Hindi for Dukandar",
        "suggested_price": float (suggested discounted selling price in INR),
        "combo_idea": "Combo or freebie deal idea",
        "spoken_summary": "Natural Hindi sentence to read out loud via voice audio TTS"
      }}
    }}
    Do NOT include markdown formatting, backticks, or extra commentary.
    """

    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-3-flash",
        "gemini-3.5-flash",
        "gemini-1.5-flash"
    ]

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
            print(f"Gemini model {model_name} error for expiry strategy: {e}")
            continue

    return {}
