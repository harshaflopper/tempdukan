import asyncio
import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.onboarding import router as onboarding_router
from routers.inventory import router as inventory_router
from routers.billing import router as billing_router
from services.billing_service import broadcast_weekly_udhaar_reminders

app = FastAPI(
    title="LastDukan AI Product Onboarding & Billing API",
    description="Multi-signal AI engine, Shop Memory & Udhaar Ledger for Village Dukandars",
    version="1.0.0"
)

# Enable CORS for Next.js / React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(onboarding_router)
app.include_router(inventory_router)
app.include_router(billing_router)

async def weekly_udhaar_scheduler_task():
    """
    Background worker that runs every Sunday at 10:00 AM local time
    to dispatch automated Kirana Udhaar SMS reminders via Vendel Gateway.
    """
    print("[Weekly Scheduler] Kirana Udhaar SMS Broadcast worker initialized.")
    while True:
        try:
            now = datetime.datetime.now()
            # 6 is Sunday in Python datetime (0=Monday, 6=Sunday)
            if now.weekday() == 6 and now.hour == 10:
                print(f"[Weekly Scheduler] Triggering Sunday Kirana Udhaar Broadcast at {now.isoformat()}...")
                res = await broadcast_weekly_udhaar_reminders(shop_id="SHOP001")
                print(f"[Weekly Scheduler] Broadcast complete: {res.get('ai_response')}")
                await asyncio.sleep(3600)
        except Exception as e:
            print(f"[Weekly Scheduler] Error in task loop: {e}")
        await asyncio.sleep(900)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(weekly_udhaar_scheduler_task())

@app.get("/")
def root():
    return {
        "app": "LastDukan AI Backend",
        "status": "Online",
        "features": ["Barcode Lookup", "Shop Visual Vector Memory", "OCR Vision", "Voice Parsing", "Vendel Weekly SMS Broadcast"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
