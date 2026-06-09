from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SkinKillNotificationCreate(BaseModel):
    skin_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=255)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    sort_order: int = Field(0, ge=0)


class SkinKillNotificationUpdate(BaseModel):
    skin_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")
    sort_order: Optional[int] = Field(None, ge=0)


class SkinKillNotificationResponse(BaseModel):
    id: UUID
    skin_id: UUID
    skin_name: Optional[str] = None
    hero_id: Optional[UUID] = None
    hero_name: Optional[str] = None
    name: str
    code: str
    image_object_name: str
    image_url: Optional[str] = None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
