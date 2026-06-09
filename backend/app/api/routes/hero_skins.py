from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.hero_skin_schema import (
    HeroSkinCreate,
    HeroSkinUpdate,
    HeroSkinResponse,
)
from app.services.hero_skin_service import HeroSkinService

router = APIRouter(tags=["Hero Skins"])


def _parse_skin_create(
    name: str = Form(...),
    skin_code: Optional[str] = Form(None),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
) -> HeroSkinCreate:
    return HeroSkinCreate(
        name=name,
        skin_code=skin_code,
        status=status,
        sort_order=sort_order,
    )


def _parse_skin_update(
    name: Optional[str] = Form(None),
    skin_code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
) -> HeroSkinUpdate:
    return HeroSkinUpdate(
        name=name,
        skin_code=skin_code,
        status=status,
        sort_order=sort_order,
    )


@router.get(
    "/api/heroes/{hero_id}/skins",
    response_model=list[HeroSkinResponse],
)
def list_skins(
    hero_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroSkinService(db)
    return service.list_skins(hero_id)


@router.post(
    "/api/heroes/{hero_id}/skins",
    response_model=HeroSkinResponse,
    status_code=201,
)
async def create_skin(
    hero_id: UUID,
    name: str = Form(...),
    skin_code: Optional[str] = Form(None),
    status: str = Form("ACTIVE"),
    sort_order: int = Form(0),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = HeroSkinCreate(
        name=name,
        skin_code=skin_code,
        status=status,
        sort_order=sort_order,
    )
    service = HeroSkinService(db)
    return await service.create_skin(hero_id, payload, image)


@router.get("/api/skins/{skin_id}", response_model=HeroSkinResponse)
def get_skin(
    skin_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroSkinService(db)
    return service.get_skin(skin_id)


@router.put("/api/skins/{skin_id}", response_model=HeroSkinResponse)
async def update_skin(
    skin_id: UUID,
    name: Optional[str] = Form(None),
    skin_code: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    payload = HeroSkinUpdate(
        name=name,
        skin_code=skin_code,
        status=status,
        sort_order=sort_order,
    )
    service = HeroSkinService(db)
    return await service.update_skin(skin_id, payload, image)


@router.delete("/api/skins/{skin_id}", status_code=204)
def delete_skin(
    skin_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroSkinService(db)
    service.delete_skin(skin_id)
