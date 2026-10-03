import httpx
from db import get_supabase
from typing import Optional, Dict, Any

async def lookup_barcode(barcode: str, shop_id: str) -> Optional[Dict[str, Any]]:
    """
    1. Check local shop inventory first for exact barcode match
    2. If missing, query Open Food Facts API for global product details
    """
    if not barcode or len(barcode.strip()) < 4:
        return None

    clean_barcode = barcode.strip()

    # 1. Search local shop DB in Supabase
    supabase = get_supabase()
    if supabase:
        try:
            response = supabase.table("products").select("*").eq("shop_id", shop_id).eq("barcode", clean_barcode).limit(1).execute()
            if response.data and len(response.data) > 0:
                item = response.data[0]
                return {
                    "source": "shop_db",
                    "product_id": item.get("id"),
                    "name": item.get("name"),
                    "brand": item.get("brand"),
                    "selling_price": item.get("selling_price"),
                    "quantity": item.get("quantity"),
                    "unit": item.get("unit"),
                    "expiry_date": item.get("expiry_date"),
                    "barcode": clean_barcode,
                    "image_url": item.get("image_url"),
                    "confidence": 1.0
                }
        except Exception as e:
            print(f"Error querying Supabase for barcode: {e}")

    # 2. Query Open Food Facts Global API
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{clean_barcode}.json"
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                if data.get("status") == 1:
                    product = data.get("product", {})
                    name = product.get("product_name_en") or product.get("product_name") or "Unknown Product"
                    brand = product.get("brands") or ""
                    quantity_str = product.get("quantity") or "1 packet"
                    image_url = product.get("image_front_url") or product.get("image_url")
                    
                    return {
                        "source": "open_food_facts",
                        "name": f"{brand} {name}".strip(),
                        "brand": brand,
                        "unit": "packet",
                        "barcode": clean_barcode,
                        "image_url": image_url,
                        "confidence": 0.95
                    }
    except Exception as e:
        print(f"Open Food Facts API error: {e}")

    return None
