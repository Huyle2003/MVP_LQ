from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.skin_crop_schema import (
    AutoDetectResponse,
    CropResponse,
    ManualCropConfig,
    DeleteCropRequest,
    CreateSkinFromCroppedRequest,
)
from app.schemas.hero_skin_schema import HeroSkinResponse
from app.services.skin_crop_service import SkinCropService

router = APIRouter(prefix="/api/skin-crop", tags=["Skin Crop"])


@router.post("/auto-detect", response_model=AutoDetectResponse)
async def auto_detect_and_crop(
    image: UploadFile = File(...),
    min_card_width: Optional[int] = Form(None),
    min_card_height: Optional[int] = Form(None),
    max_card_width: Optional[int] = Form(None),
    max_card_height: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """Auto-detect skin cards using OpenCV and crop them."""
    service = SkinCropService()
    return await service.auto_detect_and_crop(
        file=image,
        min_card_width=min_card_width,
        min_card_height=min_card_height,
        max_card_width=max_card_width,
        max_card_height=max_card_height,
    )


@router.post("/manual-crop", response_model=CropResponse)
async def manual_crop(
    image: UploadFile = File(...),
    start_x: int = Form(480),
    start_y: int = Form(175),
    card_width: int = Form(230),
    card_height: int = Form(415),
    gap_x: int = Form(12),
    row_count: int = Form(1),
    count_per_row: int = Form(5),
    current_user: dict = Depends(get_current_user),
):
    """Manual grid-based cropping (fallback)."""
    config = ManualCropConfig(
        start_x=start_x,
        start_y=start_y,
        card_width=card_width,
        card_height=card_height,
        gap_x=gap_x,
        row_count=row_count,
        count_per_row=count_per_row,
    )
    service = SkinCropService()
    return await service.manual_crop_image(file=image, config=config)


@router.delete("/items", status_code=204)
def delete_crop_item(
    payload: DeleteCropRequest,
    current_user: dict = Depends(get_current_user),
):
    service = SkinCropService()
    service.delete_crop(payload.object_name)


@router.post("/heroes/{hero_id}/skins/from-cropped", response_model=HeroSkinResponse, status_code=201)
def create_skin_from_cropped(
    hero_id: UUID,
    payload: CreateSkinFromCroppedRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinCropService(db=db)
    return service.create_skin_from_cropped(hero_id, payload)
