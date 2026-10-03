import os
from dotenv import load_dotenv

class Settings:
    @property
    def SUPABASE_URL(self) -> str:
        load_dotenv(override=True)
        return os.getenv("SUPABASE_URL", "")

    @property
    def SUPABASE_KEY(self) -> str:
        load_dotenv(override=True)
        return os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))

    @property
    def GEMINI_API_KEY(self) -> str:
        load_dotenv(override=True)
        return os.getenv("GEMINI_API_KEY", "")

    @property
    def GROQ_API_KEY(self) -> str:
        load_dotenv(override=True)
        return os.getenv("GROQ_API_KEY", "")

    @property
    def OPENAI_API_KEY(self) -> str:
        load_dotenv(override=True)
        return os.getenv("OPENAI_API_KEY", "")

    @property
    def DEFAULT_SHOP_ID(self) -> str:
        return os.getenv("DEFAULT_SHOP_ID", "SHOP001")

    @property
    def VECTOR_SIMILARITY_THRESHOLD(self) -> float:
        return float(os.getenv("VECTOR_SIMILARITY_THRESHOLD", "0.82"))

settings = Settings()
