from fastapi import Depends, HTTPException, Header
from supabase import Client
from app.core.database import get_supabase


async def get_current_user(
    authorization: str = Header(None),
    supabase: Client = Depends(get_supabase),
) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证令牌")

    token = authorization.replace("Bearer ", "")
    try:
        user = supabase.auth.get_user(token)
        return user.user.model_dump() if hasattr(user.user, "model_dump") else dict(user.user)
    except Exception:
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")


async def get_user_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
) -> dict:
    response = supabase.table("settings").select("*").eq("user_id", current_user["id"]).execute()
    if not response.data:
        return {"api_key": "", "model": "gpt-4o", "temperature": 0.7, "max_tokens": 2000}
    row = response.data[0]
    return {
        "api_key": row.get("api_key", ""),
        "model": row.get("model", "gpt-4o"),
        "temperature": row.get("temperature", 0.7),
        "max_tokens": row.get("max_tokens", 2000),
    }
