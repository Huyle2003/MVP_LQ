from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CountedImageCreate(BaseModel):
    name: str = Field(..., min_length=1)
    code: Optional[str] = None
    default_quantity: int = Field(0, ge=0)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    sort_order: int = Field(0, ge=0)


class CountedImageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    code: Optional[str] = None
    default_quantity: Optional[int] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(ACTIVE|INACTIVE)$")
    sort_order: Optional[int] = Field(None, ge=0)


class CountedImageResponse(BaseModel):
    id: UUID
    name: str
    code: str
    image_object_name: str
    image_url: Optional[str] = None
    default_quantity: int
    status: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
