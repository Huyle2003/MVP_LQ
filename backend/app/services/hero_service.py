import uuid
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Hero
from app.repositories.hero_repository import HeroRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.hero_schema import HeroCreate, HeroUpdate, HeroResponse
from app.utils.slug import to_slug


class HeroService:
    def __init__(self, db: Session, storage: Optional[StorageRepository] = None):
        self.repo = HeroRepository(db)
        self.storage = storage or StorageRepository()

    def _hero_to_response(self, hero: Hero) -> HeroResponse:
        skin_count = self.repo.count_skins(hero.id)
        avatar_url = None
        if hero.avatar_object_name:
            avatar_url = self.storage.preview_url(hero.avatar_object_name)
        return HeroResponse(
            id=hero.id,
            name=hero.name,
            code=hero.code,
            avatar_object_name=hero.avatar_object_name,
            avatar_url=avatar_url,
            status=hero.status,
            skin_count=skin_count,
            created_at=hero.created_at,
            updated_at=hero.updated_at,
        )

    def list_heroes(
        self,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[HeroResponse]:
        heroes = self.repo.list_heroes(keyword=keyword, status=status)
        return [self._hero_to_response(h) for h in heroes]

    def get_hero(self, hero_id: UUID) -> HeroResponse:
        hero = self.repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tướng",
            )
        return self._hero_to_response(hero)

    def create_hero(self, payload: HeroCreate) -> HeroResponse:
        code = payload.code or to_slug(payload.name)

        if not code.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể sinh code từ tên tướng",
            )

        if self.repo.get_by_name(payload.name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tên tướng đã tồn tại",
            )

        if self.repo.get_by_code(code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Mã tướng đã tồn tại",
            )

        hero = Hero(
            id=uuid.uuid4(),
            name=payload.name.strip(),
            code=code,
            status=payload.status,
        )
        hero = self.repo.create(hero)
        return self._hero_to_response(hero)

    def update_hero(self, hero_id: UUID, payload: HeroUpdate) -> HeroResponse:
        hero = self.repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tướng",
            )

        if payload.name is not None:
            stripped_name = payload.name.strip()
            if not stripped_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tên tướng không được để trống",
                )
            existing = self.repo.get_by_name(stripped_name)
            if existing and existing.id != hero_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Tên tướng đã tồn tại",
                )
            hero.name = stripped_name

        if payload.code is not None:
            stripped_code = payload.code.strip()
            if stripped_code:
                existing = self.repo.get_by_code(stripped_code)
                if existing and existing.id != hero_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Mã tướng đã tồn tại",
                    )
                hero.code = stripped_code
            else:
                hero.code = to_slug(hero.name)

        if payload.status is not None:
            hero.status = payload.status

        hero = self.repo.update(hero)
        return self._hero_to_response(hero)

    def delete_hero(self, hero_id: UUID) -> None:
        hero = self.repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tướng",
            )

        skin_count = self.repo.count_skins(hero_id)
        if skin_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể xóa tướng đang có {skin_count} skin",
            )

        self.repo.delete(hero)
