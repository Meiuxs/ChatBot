import logging
from functools import lru_cache
from supabase import create_client, Client
from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache()
def get_supabase() -> Client:
    settings = get_settings()
    supabase_url = settings.supabase_url
    logger.info("DB creating Supabase client url=%s", supabase_url)
    return create_client(supabase_url, settings.supabase_key)
