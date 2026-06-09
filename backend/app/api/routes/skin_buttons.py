from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.skin_button_schema import (
    SkinButtonCreate, SkinButtonUpdate, SkinButtonResponse,
)
from app.services.skin_button_service import SkinButtonService

router = APIRouter(prefix="/api/skin-buttons", tags=["Skin Buttons"])


@router.get("", response_model=list[SkinButtonResponse])
def list_buttons(
    keyword: Optional[str] = Query(None),
    hero_id: Optional[UUID] = Query(None),
    skin_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinButtonService(db)
    return service.list(keyword=keyword, hero_id=hero_id, skin_id=skin_id, status=status)


@router.get("/{button_id}", response_model=SkinButtonResponse)
def get_button(
    button_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinButtonService(db)
    return service.get(button_id)


@router.post("", response_model=SkinButtonResponse, status_code=201)
async def create_button(
    skin_id: UUID = Form(...),
    name: str = Form(...),
    code: Optional[str] = Form(None),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = SkinButtonCreate(skin_id=skin_id, name=name, code=code, status=status, sort_order=sort_order)
    service = SkinButtonService(db)
    return await service.create(payload, image)


@router.put("/{button_id}", response_model=SkinButtonResponse)
async def update_button(
    button_id: UUID,
    skin_id: Optional[UUID] = Form(None),
    name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = SkinButtonUpdate(skin_id=skin_id, name=name, code=code, status=status, sort_order=sort_order)
    service = SkinButtonService(db)
    return await service.update(button_id, payload, image)


@router.delete("/{button_id}", status_code=204)
def delete_button(
    button_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinButtonService(db)
    service.delete(button_id)
