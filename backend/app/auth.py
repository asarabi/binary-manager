from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import get_config

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()


def create_access_token(expires_delta: timedelta | None = None) -> str:
    config = get_config()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode = {"exp": expire, "sub": "user"}
    return jwt.encode(to_encode, config.auth.jwt_secret, algorithm=ALGORITHM)


def verify_password(password: str) -> bool:
    config = get_config()
    return password == config.auth.shared_password


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    config = get_config()
    try:
        payload = jwt.decode(credentials.credentials, config.auth.jwt_secret, algorithms=[ALGORITHM])
        sub: str | None = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return sub
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
