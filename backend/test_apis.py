import httpx
import asyncio
from config import settings

async def test_gemini_2_flash():
    print("--- Testing Gemini 2.0 Flash API ---")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": "Hello! Confirm you are Gemini 2.0 Flash."}]}]
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(url, json=payload)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                print("Gemini 2.0 Response:", res.json()["candidates"][0]["content"]["parts"][0]["text"])
            else:
                print("Gemini Error:", res.text)
        except Exception as e:
            print("Gemini Exception:", e)

async def test_groq():
    print("\n--- Testing Groq API ---")
    url = "https://api.groq.com/openai/v1/models"
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(url, headers=headers)
            print(f"Status Code: {res.status_code}")
            if res.status_code == 200:
                models = [m["id"] for m in res.json().get("data", []) if "whisper" in m["id"]]
                print("Available Groq Whisper Models:", models)
            else:
                print("Groq Error:", res.text)
        except Exception as e:
            print("Groq Exception:", e)

if __name__ == "__main__":
    asyncio.run(test_gemini_2_flash())
    asyncio.run(test_groq())
