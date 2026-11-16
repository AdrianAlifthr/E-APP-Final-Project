import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")

if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError(
        "Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan "
        "SUPABASE_PUBLISHABLE_KEY di file .env."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
