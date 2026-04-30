from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.core.database import get_supabase
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, supabase: Client = Depends(get_supabase)):
    try:
        result = supabase.auth.sign_up({"email": request.email, "password": request.password})
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, supabase: Client = Depends(get_supabase)):
    try:
        result = supabase.auth.sign_in_with_password(
            {"email": request.email, "password": request.password}
        )
        return AuthResponse(
            user={"id": result.user.id, "email": result.user.email},
            session={
                "access_token": result.session.access_token,
                "refresh_token": result.session.refresh_token,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
