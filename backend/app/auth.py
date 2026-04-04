from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import get_config

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()


def create_access_token(username: str, role: str, expires_delta: timedelta | None = None) -> str:
    config = get_config()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode = {"exp": expire, "sub": username, "role": role}
    return jwt.encode(to_encode, config.auth.jwt_secret, algorithm=ALGORITHM)


def verify_user(username: str, password: str) -> str | None:
    """Returns role if credentials are valid, None otherwise."""
    config = get_config()
    for user in config.auth.users:
        if user.username == username and user.password == password:
            return user.role
    return None


def _decode_token(credentials: HTTPAuthorizationCredentials) -> dict:
    config = get_config()
    try:
        payload = jwt.decode(credentials.credentials, config.auth.jwt_secret, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return _decode_token(credentials)["sub"]


def get_current_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return _decode_token(credentials).get("role", "user")


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    payload = _decode_token(credentials)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload["sub"]
