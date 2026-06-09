from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import User
from app.schemas.auth_schema import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UserResponse,
)


class AuthService:
    def __init__(self, db: Optional[Session] = None):
        self.settings = get_settings()
        self.db = db

    def _read_private_key(self) -> str:
        key_path = Path(self.settings.jwt_private_key_path)
        if not key_path.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Không tìm thấy private key tại {key_path}",
            )
        return key_path.read_text(encoding="utf-8")

    def _read_public_key(self) -> str:
        key_path = Path(self.settings.jwt_public_key_path)
        if not key_path.exists():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Không tìm thấy public key tại {key_path}",
            )
        return key_path.read_text(encoding="utf-8")

    def _get_user_by_email(self, email: str):
        if not self.db:
            return None
        return self.db.query(User).filter(User.email == email).first()

    def login(self, request: LoginRequest) -> LoginResponse:
        db_user = self._get_user_by_email(request.email)
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không đúng",
            )
        if db_user.status == "LOCKED":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tài khoản của bạn đã bị khóa.",
            )
        if db_user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tài khoản chưa được kích hoạt. Hãy liên hệ admin để kích hoạt.",
            )
        if not bcrypt.checkpw(request.password.encode("utf-8"), db_user.password_hash.encode("utf-8")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không đúng",
            )

        user = UserResponse(id=str(db_user.id), email=db_user.email, role=db_user.role)
        token = self.create_access_token(user)
        return LoginResponse(access_token=token, user=user)

    def register(self, request: RegisterRequest) -> LoginResponse:
        if not self.db:
            raise HTTPException(status_code=500, detail="Database not available")

        existing = self._get_user_by_email(request.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email đã được đăng ký")

        pw_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        db_user = User(email=request.email, password_hash=pw_hash, role="USER", status="INACTIVE")
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)

        user = UserResponse(id=str(db_user.id), email=db_user.email, role=db_user.role)
        token = self.create_access_token(user)
        return LoginResponse(access_token=token, user=user)

    def create_access_token(self, user: UserResponse) -> str:
        now = datetime.now(timezone.utc)
        expire = now + timedelta(minutes=self.settings.jwt_expire_minutes)

        payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "iat": int(now.timestamp()),
            "exp": int(expire.timestamp()),
        }

        return jwt.encode(
            payload,
            self._read_private_key(),
            algorithm=self.settings.jwt_algorithm,
        )

    def verify_token(self, token: str) -> dict:
        try:
            return jwt.decode(
                token,
                self._read_public_key(),
                algorithms=[self.settings.jwt_algorithm],
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token đã hết hạn",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không hợp lệ",
            )
