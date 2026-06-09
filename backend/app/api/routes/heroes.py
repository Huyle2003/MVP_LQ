from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.schemas.hero_schema import HeroCreate, HeroUpdate, HeroResponse
from app.services.hero_service import HeroService

router = APIRouter(prefix="/api/heroes", tags=["Heroes"])


@router.get("", response_model=list[HeroResponse])
def list_heroes(
    keyword: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroService(db)
    return service.list_heroes(keyword=keyword, status=status)


@router.get("/{hero_id}", response_model=HeroResponse)
def get_hero(
    hero_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroService(db)
    return service.get_hero(hero_id)


@router.post("", response_model=HeroResponse, status_code=201)
def create_hero(
    payload: HeroCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroService(db)
    return service.create_hero(payload)


@router.put("/{hero_id}", response_model=HeroResponse)
def update_hero(
    hero_id: UUID,
    payload: HeroUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroService(db)
    return service.update_hero(hero_id, payload)


@router.delete("/{hero_id}", status_code=204)
def delete_hero(
    hero_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    service = HeroService(db)
    service.delete_hero(hero_id)
