# LastDukan (Tempdukan) - AI-Powered Visual & Voice Product Onboarding PWA

LastDukan is an intelligent inventory onboarding assistant designed for rural and kirana shopkeepers. It simplifies product entry into a 2-step flow:
1. **Snap**: Take a product photo. Gemini 2.5 Flash detects product name, brand, variant, MRP, selling price, and expiry date.
2. **Audio / Voice**: Speak additional details (e.g. quantity, discount, expiry). Groq Whisper transcribes and parses voice context.

The system performs **visual similarity searching** using vector embeddings against existing inventory to detect duplicates automatically, updating stock units without creating duplicate records.

---

## Architecture Overview

- **Frontend**: Next.js 14 (App Router), Tailwind CSS (Emerald & Slate design theme), HTML5 Camera API, MediaRecorder API (audio/webm, opus).
- **Backend**: Python FastAPI, `google-genai` SDK (Gemini 2.5 Flash), `groq` SDK (Whisper-large-v3), Supabase REST API Client (PostgreSQL + pgvector).
- **Database**: Supabase PostgreSQL with `products` table, vector embeddings, and storage buckets.

---

## Setup & Running Locally

### Backend Setup

```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Unix: source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your Supabase, Gemini, and Groq API keys:
```bash
cp .env.example .env
```

Start backend API server:
```bash
python main.py
# Server runs at http://localhost:8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:3000
```

---

## Features

- 📸 **AI Vision OCR & Price Extraction**: Automatically extracts details from product packaging.
- 🎙️ **Voice Context Parsing**: Audio transcription for fast quantity, price, and expiry overrides.
- 🧠 **Shop Visual Memory**: Prevents duplicate inventory items using embedding similarity search.
- ⚡ **Instant DB Save**: Live catalog updating with zero extra clicks.
