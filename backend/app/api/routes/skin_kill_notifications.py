from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.skin_kill_notification_schema import (
    SkinKillNotificationCreate, SkinKillNotificationUpdate, SkinKillNotificationResponse,
)
from app.services.skin_kill_notification_service import SkinKillNotificationService

router = APIRouter(prefix="/api/skin-kill-notifications", tags=["Skin Kill Notifications"])


@router.get("", response_model=list[SkinKillNotificationResponse])
def list_notifications(
    keyword: Optional[str] = Query(None),
    hero_id: Optional[UUID] = Query(None),
    skin_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinKillNotificationService(db)
    return service.list(keyword=keyword, hero_id=hero_id, skin_id=skin_id, status=status)


@router.get("/{ntf_id}", response_model=SkinKillNotificationResponse)
def get_notification(
    ntf_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinKillNotificationService(db)
    return service.get(ntf_id)


@router.post("", response_model=SkinKillNotificationResponse, status_code=201)
async def create_notification(
    skin_id: UUID = Form(...),
    name: str = Form(...),
    code: Optional[str] = Form(None),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = SkinKillNotificationCreate(skin_id=skin_id, name=name, code=code, status=status, sort_order=sort_order)
    service = SkinKillNotificationService(db)
    return await service.create(payload, image)


@router.put("/{ntf_id}", response_model=SkinKillNotificationResponse)
async def update_notification(
    ntf_id: UUID,
    skin_id: Optional[UUID] = Form(None),
    name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = SkinKillNotificationUpdate(skin_id=skin_id, name=name, code=code, status=status, sort_order=sort_order)
    service = SkinKillNotificationService(db)
    return await service.update(ntf_id, payload, image)


@router.delete("/{ntf_id}", status_code=204)
def delete_notification(
    ntf_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = SkinKillNotificationService(db)
    service.delete(ntf_id)
