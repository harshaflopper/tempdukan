from fastapi import APIRouter, HTTPException
from db import get_supabase
from config import settings
from typing import List, Dict, Any

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.shop_memory_service import save_product_to_shop_memory, update_product_stock
from services.expiry_service import get_shop_expiry_analysis

class ProductConfirmRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    product: Dict[str, Any]

class ProductUpdateRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    add_quantity: Optional[float] = None
    deduct_quantity: Optional[float] = None
    new_quantity: Optional[float] = None
    selling_price: Optional[float] = None
    expiry_date: Optional[str] = None

class ApplyDiscountRequest(BaseModel):
    shop_id: str = settings.DEFAULT_SHOP_ID
    product_id: str
    suggested_price: float

router = APIRouter(prefix="/api/v1", tags=["Shop Inventory"])

@router.get("/expiry/analysis")
async def get_expiry_analysis_endpoint(shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Fetches shop expiry risk analysis and AI clearance strategies from Gemini Flash.
    """
    return await get_shop_expiry_analysis(shop_id)

@router.post("/expiry/apply-discount")
async def apply_expiry_discount_price(req: ApplyDiscountRequest):
    """
    Applies suggested AI clearance discount price to a product.
    """
    updated = await update_product_stock(
        product_id=req.product_id,
        shop_id=req.shop_id,
        selling_price=req.suggested_price
    )
    if updated:
        return {"success": True, "product": updated, "message": f"Updated price to ₹{req.suggested_price}"}
    raise HTTPException(status_code=500, detail="Failed to update clearance discount price")

@router.get("/products")
async def get_shop_inventory(shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Fetches all items in the shop's inventory from Supabase.
    """
    supabase = get_supabase()
    if not supabase:
        return {"shop_id": shop_id, "products": []}

    try:
        res = supabase.table("products").select("*").eq("shop_id", shop_id).order("created_at", desc=True).execute()
        return {
            "shop_id": shop_id,
            "total_items": len(res.data) if res.data else 0,
            "products": res.data or []
        }
    except Exception as e:
        print(f"Error fetching inventory from Supabase: {e}")
        return {"shop_id": shop_id, "products": [], "error": str(e)}

@router.post("/confirm-product")
async def confirm_product_entry(req: ProductConfirmRequest):
    """
    Saves a photo-only entry directly into Supabase shop inventory.
    """
    saved = await save_product_to_shop_memory(req.shop_id, req.product)
    if saved:
        return {"success": True, "product": saved}
    raise HTTPException(status_code=500, detail="Failed to save product to inventory")

@router.patch("/products/{product_id}")
async def update_product(product_id: str, req: ProductUpdateRequest):
    """
    Updates stock quantity (add, deduct, or set), selling price, and/or expiry date for an existing product.
    """
    updated = await update_product_stock(
        product_id=product_id,
        shop_id=req.shop_id,
        add_quantity=req.add_quantity,
        deduct_quantity=req.deduct_quantity,
        new_quantity=req.new_quantity,
        selling_price=req.selling_price,
        expiry_date=req.expiry_date
    )
    if updated:
        return {"success": True, "product": updated}
    raise HTTPException(status_code=500, detail="Failed to update product stock")

@router.delete("/products/{product_id}")
async def delete_shop_product(product_id: str, shop_id: str = settings.DEFAULT_SHOP_ID):
    """
    Deletes a product from shop inventory.
    """
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Database client not configured")

    try:
        supabase.table("products").delete().eq("id", product_id).eq("shop_id", shop_id).execute()
        return {"success": True, "message": "Product removed from inventory"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
