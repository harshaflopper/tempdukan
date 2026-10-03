from db import get_supabase
from config import settings
from typing import List, Dict, Any, Optional
import time
import re

async def search_shop_visual_memory(
    shop_id: str,
    query_embedding: List[float],
    threshold: float = 0.82,
    limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Performs cosine vector similarity search against products saved in this shop's database.
    """
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        payload = {
            "query_shop_id": shop_id,
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": limit
        }
        res = supabase.rpc("match_shop_products", payload).execute()
        if res.data:
            return res.data
    except Exception as e:
        print(f"Shop visual memory vector search error: {e}")

    return []

def normalize_words(text: str) -> set:
    if not text:
        return set()
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    words = set(clean.split())
    stopwords = {'limited', 'edition', 'pack', 'packet', 'box', 'pcs', 'unit', 'g', 'kg', 'ml', 'item', 'product'}
    return {w for w in words if len(w) > 1 and w not in stopwords}

async def find_existing_product(
    shop_id: str,
    candidate_name: Optional[str] = None,
    query_embedding: Optional[List[float]] = None,
    image_bytes: Optional[bytes] = None
) -> Optional[Dict[str, Any]]:
    """
    Checks if a product already exists in shop inventory by:
    1. Gemini Multimodal Visual Image Match (compares snapped photo directly against shop inventory photos/items)
    2. Visual Vector Search (if embedding is provided)
    3. Intelligent Normalized Substring & Token Search in Supabase DB
    """
    supabase = get_supabase()
    if not supabase:
        return None

    # Fetch existing products in shop inventory
    try:
        res = supabase.table("products").select("*").eq("shop_id", shop_id).order("created_at", desc=True).execute()
        existing_items = res.data or []
    except Exception as e:
        print(f"Error fetching products for matching: {e}")
        existing_items = []

    # 1. PRIMARY STEP: MULTIMODAL VISUAL IMAGE MATCHING USING GEMINI 2.5 FLASH VISION
    if image_bytes and len(image_bytes) > 100 and existing_items:
        try:
            from services.vision_service import visually_match_product_with_gemini
            visual_match = await visually_match_product_with_gemini(image_bytes, existing_items)
            if visual_match:
                print(f"PRIMARY VISUAL MATCH SUCCESS: Matched '{visual_match.get('name')}' using photo visual features!")
                return visual_match
        except Exception as e:
            print(f"Multimodal visual match notice: {e}")

    # 2. SECONDARY STEP: Visual Vector Search
    if query_embedding:
        try:
            matches = await search_shop_visual_memory(
                shop_id=shop_id,
                query_embedding=query_embedding,
                threshold=0.75,
                limit=1
            )
            if matches and len(matches) > 0:
                print(f"Visual memory vector match found: {matches[0].get('name')}")
                return matches[0]
        except Exception as e:
            print(f"Vector search notice: {e}")

    # 3. TERTIARY STEP: Database Intelligent Substring & Token Search
    if candidate_name and candidate_name != "Unrecognized Item" and existing_items:
        cand_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', candidate_name.lower()).strip()
        cand_tokens = normalize_words(candidate_name)

        for item in existing_items:
            db_name = item.get("name") or ""
            db_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', db_name.lower()).strip()
            db_tokens = normalize_words(db_name)

            # Check A: Direct normalized substring match
            if db_clean and cand_clean and (db_clean in cand_clean or cand_clean in db_clean):
                print(f"SUCCESS: Product normalized substring match found: '{db_name}' for candidate '{candidate_name}'")
                return item

            # Check B: Shared brand/key tokens match
            shared = cand_tokens.intersection(db_tokens)
            if shared:
                min_token_count = min(len(cand_tokens), len(db_tokens))
                if len(shared) >= min_token_count or len(shared) >= 2 or (len(shared) == 1 and list(shared)[0] in ('chawal', 'aata', 'cheeni', 'sugar', 'dal')):
                    print(f"SUCCESS: Product token match found: '{db_name}' (Shared tokens: {shared}) for candidate '{candidate_name}'")
                    return item

    return None

async def update_product_stock(
    product_id: str,
    shop_id: str,
    add_quantity: Optional[float] = None,
    new_quantity: Optional[float] = None,
    selling_price: Optional[float] = None,
    expiry_date: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Updates stock quantity, selling price, and/or expiry date for an existing product in Supabase.
    """
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        res = supabase.table("products").select("*").eq("id", product_id).eq("shop_id", shop_id).execute()
        if not res.data or len(res.data) == 0:
            print(f"Product {product_id} not found for shop {shop_id}")
            return None

        current = res.data[0]
        current_qty = float(current.get("quantity", 0))

        if new_quantity is not None:
            final_qty = float(new_quantity)
        elif add_quantity is not None:
            final_qty = current_qty + float(add_quantity)
        else:
            final_qty = current_qty

        payload = {
            "quantity": final_qty,
            "updated_at": "NOW()"
        }

        if selling_price is not None and selling_price > 0:
            payload["selling_price"] = float(selling_price)

        if expiry_date is not None and len(expiry_date.strip()) > 0:
            payload["expiry_date"] = expiry_date.strip()

        upd_res = supabase.table("products").update(payload).eq("id", product_id).eq("shop_id", shop_id).execute()
        if upd_res.data and len(upd_res.data) > 0:
            print(f"Successfully updated product {product_id}: quantity={final_qty}, selling_price={payload.get('selling_price')}, expiry_date={payload.get('expiry_date')}")
            return upd_res.data[0]
    except Exception as e:
        print(f"Error updating product stock in Supabase: {e}")

    return None

async def save_product_to_shop_memory(shop_id: str, product_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Saves product details + visual vector embedding into Supabase products table.
    """
    supabase = get_supabase()
    if not supabase:
        print("Error: Supabase client is not available in save_product_to_shop_memory.")
        return None

    try:
        name = product_data.get("name") or f"Product {int(time.time())}"
        
        record = {
            "shop_id": shop_id,
            "name": name,
            "brand": product_data.get("brand") or "",
            "category": product_data.get("category", "General"),
            "selling_price": float(product_data.get("selling_price") or 0.0),
            "cost_price": float(product_data.get("cost_price") or 0.0),
            "quantity": float(product_data.get("quantity") or 1.0),
            "unit": product_data.get("unit") or "packet",
            "is_loose": bool(product_data.get("is_loose", False)),
            "price_unit": product_data.get("price_unit") or "per_item",
            "expiry_date": product_data.get("expiry_date") or "",
            "barcode": product_data.get("barcode") or "",
            "image_url": product_data.get("image_url") or "",
            "visual_embedding": product_data.get("visual_embedding")
        }
        
        res = supabase.table("products").insert(record).execute()
        if res.data and len(res.data) > 0:
            print(f"SUCCESS: Saved product '{name}' to Supabase with ID {res.data[0]['id']}")
            return res.data[0]
        else:
            print(f"Supabase Insert returned empty data: {res}")
    except Exception as e:
        print(f"Error saving product to Supabase: {e}")

    return None
