from fastapi import APIRouter, Depends, HTTPException
from supabase import Client
from app.core.database import get_supabase
from app.api.deps import get_current_user
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
        msg = str(e).lower()
        if "rate limit" in msg or "too many" in msg:
            raise HTTPException(status_code=429, detail="注册过于频繁，请稍后再试")
        if "already registered" in msg:
            raise HTTPException(status_code=409, detail="该邮箱已被注册")
        if "invalid email" in msg:
            raise HTTPException(status_code=400, detail="邮箱格式不正确")
        if "password" in msg and "characters" in msg:
            raise HTTPException(status_code=400, detail="密码长度至少为 6 位")
        raise HTTPException(status_code=400, detail="注册失败，请稍后重试")


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


@router.post("/logout")
async def logout():
    return {"success": True}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"email": current_user.get("email", "")}
