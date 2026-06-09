from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.other_image_schema import (
    OtherImageCreate,
    OtherImageUpdate,
    OtherImageResponse,
)
from app.services.other_image_service import OtherImageService

router = APIRouter(prefix="/api/other-images", tags=["Other Images"])


@router.get("", response_model=list[OtherImageResponse])
def list_other_images(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = OtherImageService(db)
    return service.list(keyword=keyword, status=status)


@router.get("/{item_id}", response_model=OtherImageResponse)
def get_other_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = OtherImageService(db)
    return service.get(item_id)


@router.post("", response_model=OtherImageResponse, status_code=201)
async def create_other_image(
    name: str = Form(...),
    code: Optional[str] = Form(None),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = OtherImageCreate(name=name, code=code, status=status, sort_order=sort_order)
    service = OtherImageService(db)
    return await service.create(payload, image)


@router.put("/{item_id}", response_model=OtherImageResponse)
async def update_other_image(
    item_id: UUID,
    name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = OtherImageUpdate(name=name, code=code, status=status, sort_order=sort_order)
    service = OtherImageService(db)
    return await service.update(item_id, payload, image)


@router.delete("/{item_id}", status_code=204)
def delete_other_image(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = OtherImageService(db)
    service.delete(item_id)
