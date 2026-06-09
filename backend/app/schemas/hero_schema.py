from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HeroCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=255)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")


class HeroUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")


class HeroResponse(BaseModel):
    id: UUID
    name: str
    code: str
    avatar_object_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    skin_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
