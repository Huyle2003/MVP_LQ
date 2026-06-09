from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: str
    email: str
    role: str


class UserFullResponse(BaseModel):
    id: UUID
    email: str
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field("USER", pattern="^(ADMIN|USER)$")
    status: str = Field("INACTIVE", pattern="^(ACTIVE|INACTIVE|LOCKED)$")


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[str] = Field(None, pattern="^(ADMIN|USER)$")
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE|LOCKED)$")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserResponse
