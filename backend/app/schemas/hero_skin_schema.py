from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HeroSkinCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    skin_code: Optional[str] = Field(None, max_length=255)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    sort_order: int = Field(0, ge=0)


class HeroSkinUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    skin_code: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")
    sort_order: Optional[int] = Field(None, ge=0)


class HeroSkinResponse(BaseModel):
    id: UUID
    hero_id: UUID
    name: str
    skin_code: str
    image_object_name: str
    image_url: Optional[str] = None
    preview_object_name: Optional[str] = None
    preview_url: Optional[str] = None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
