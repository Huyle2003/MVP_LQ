from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Auto-detect ──────────────────────────────────────────
class CardBoxResponse(BaseModel):
    """Bounding box of a detected card."""
    x: int
    y: int
    width: int
    height: int


class AutoDetectItem(BaseModel):
    """A single cropped skin image from auto-detect."""
    index: int
    object_name: str
    image_url: str
    box: CardBoxResponse


class AutoDetectResponse(BaseModel):
    """Response from auto-detect endpoint."""
    image_width: int
    image_height: int
    detected_count: int
    items: list[AutoDetectItem]


# ─── Manual crop ──────────────────────────────────────────
class ManualCropConfig(BaseModel):
    """Configuration for manual grid cropping."""
    start_x: int = Field(480, ge=0)
    start_y: int = Field(175, ge=0)
    card_width: int = Field(230, ge=1)
    card_height: int = Field(415, ge=1)
    gap_x: int = Field(12, ge=0)
    row_count: int = Field(1, ge=1, le=10)
    count_per_row: int = Field(5, ge=1, le=20)


class CropItemResponse(BaseModel):
    """A single cropped skin image response (manual)."""
    index: int
    object_name: str
    image_url: str


class CropResponse(BaseModel):
    """Response after manual cropping."""
    items: list[CropItemResponse]


# ─── Shared ────────────────────────────────────────────────
class DeleteCropRequest(BaseModel):
    """Request to delete a cropped image."""
    object_name: str = Field(..., min_length=1)


class CreateSkinFromCroppedRequest(BaseModel):
    """Request to create a hero_skin from a cropped image."""
    name: str = Field(..., min_length=1, max_length=255)
    skin_code: Optional[str] = Field(None, max_length=255)
    cropped_object_name: str = Field(..., min_length=1)
    status: str = Field("ACTIVE", pattern="^(ACTIVE|INACTIVE)$")
    sort_order: int = Field(0, ge=0)
