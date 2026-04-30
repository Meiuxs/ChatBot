from fastapi import APIRouter, Depends
from supabase import Client
from app.core.database import get_supabase
from app.schemas.settings import SettingsResponse, UpdateSettingsRequest
from app.api.deps import get_current_user

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    response = supabase.table("settings").select("*").eq("user_id", current_user["id"]).execute()
    if not response.data:
        return SettingsResponse(apiKey="", model="gpt-4o", temperature=0.7, maxTokens=2000)

    row = response.data[0]
    return SettingsResponse(
        apiKey=row.get("api_key", ""),
        model=row.get("model", "gpt-4o"),
        temperature=row.get("temperature", 0.7),
        maxTokens=row.get("max_tokens", 2000),
    )


@router.put("")
async def update_settings(
    request: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    data = {
        "api_key": request.apiKey,
        "model": request.model,
        "temperature": request.temperature,
        "max_tokens": request.maxTokens,
        "updated_at": "now()",
    }

    existing = supabase.table("settings").select("*").eq("user_id", current_user["id"]).execute()
    if existing.data:
        supabase.table("settings").update(data).eq("user_id", current_user["id"]).execute()
    else:
        data["user_id"] = current_user["id"]
        supabase.table("settings").insert(data).execute()

    return {"success": True}
