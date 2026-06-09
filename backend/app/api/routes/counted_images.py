from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.counted_image_schema import (
    CountedImageCreate,
    CountedImageUpdate,
    CountedImageResponse,
)
from app.services.counted_image_service import CountedImageService

router = APIRouter(prefix="/api/counted-images", tags=["Counted Images"])


@router.get("", response_model=list[CountedImageResponse])
def list_counted_images(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = CountedImageService(db)
    return service.list(keyword=keyword, status=status)


@router.get("/{item_id}", response_model=CountedImageResponse)
def get_counted_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = CountedImageService(db)
    return service.get(item_id)


@router.post("", response_model=CountedImageResponse, status_code=201)
async def create_counted_image(
    name: str = Form(...),
    code: Optional[str] = Form(None),
    default_quantity: int = Form(0),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = CountedImageCreate(
        name=name, code=code,
        default_quantity=default_quantity,
        status=status, sort_order=sort_order,
    )
    service = CountedImageService(db)
    return await service.create(payload, image)


@router.put("/{item_id}", response_model=CountedImageResponse)
async def update_counted_image(
    item_id: UUID,
    name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    default_quantity: Optional[int] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = CountedImageUpdate(
        name=name, code=code,
        default_quantity=default_quantity,
        status=status, sort_order=sort_order,
    )
    service = CountedImageService(db)
    return await service.update(item_id, payload, image)


@router.delete("/{item_id}", status_code=204)
def delete_counted_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = CountedImageService(db)
    service.delete(item_id)
