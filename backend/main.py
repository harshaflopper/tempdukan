from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.onboarding import router as onboarding_router
from routers.inventory import router as inventory_router

app = FastAPI(
    title="LastDukan AI Product Onboarding API",
    description="Multi-signal AI engine & Shop Memory for Village Dukandars",
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

@app.get("/")
def root():
    return {
        "app": "LastDukan AI Backend",
        "status": "Online",
        "features": ["Barcode Lookup", "Shop Visual Vector Memory", "OCR Vision", "Voice Parsing"]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
