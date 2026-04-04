from fastapi import APIRouter, HTTPException, status

from ..auth import create_access_token, verify_user
from ..schemas import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    role = verify_user(request.username, request.password)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(request.username, role)
    return LoginResponse(access_token=token, role=role)
