from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OtherImageCreate(BaseModel):
    name: str = Field(..., min_length=1)
    code: Optional[str] = None
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    sort_order: int = Field(0, ge=0)


class OtherImageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    code: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")
    sort_order: Optional[int] = Field(None, ge=0)


class OtherImageResponse(BaseModel):
    id: UUID
    name: str
    code: str
    image_object_name: str
    image_url: Optional[str] = None
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
