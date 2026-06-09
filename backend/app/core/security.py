from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services.auth_service import AuthService

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = credentials.credentials

    auth_service = AuthService()
    payload = auth_service.verify_token(token)

    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
    }


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập",
        )

    return current_user
