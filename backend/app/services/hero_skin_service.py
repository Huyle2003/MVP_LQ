import uuid
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from app.db.models import HeroSkin
from app.repositories.hero_repository import HeroRepository
from app.repositories.hero_skin_repository import HeroSkinRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.hero_skin_schema import (
    HeroSkinCreate,
    HeroSkinUpdate,
    HeroSkinResponse,
)
from app.utils.slug import to_slug

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _ext_guard(filename: str) -> str:
    import os

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng file không được hỗ trợ: {ext}. Chỉ chấp nhận jpg, jpeg, png, webp",
        )
    return ext


class HeroSkinService:
    def __init__(self, db: Session, storage: Optional[StorageRepository] = None):
        self.hero_repo = HeroRepository(db)
        self.skin_repo = HeroSkinRepository(db)
        self.storage = storage or StorageRepository()

    def _skin_to_response(self, skin: HeroSkin) -> HeroSkinResponse:
        image_url = self.storage.presigned_url(skin.image_object_name)
        preview_url = None
        if skin.preview_object_name:
            preview_url = self.storage.presigned_url(skin.preview_object_name)
        return HeroSkinResponse(
            id=skin.id,
            hero_id=skin.hero_id,
            name=skin.name,
            skin_code=skin.skin_code,
            image_object_name=skin.image_object_name,
            image_url=image_url,
            preview_object_name=skin.preview_object_name,
            preview_url=preview_url,
            status=skin.status,
            sort_order=skin.sort_order,
            created_at=skin.created_at,
            updated_at=skin.updated_at,
        )

    def list_skins(self, hero_id: UUID) -> list[HeroSkinResponse]:
        hero = self.hero_repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tướng",
            )
        skins = self.skin_repo.list_by_hero(hero_id)
        return [self._skin_to_response(s) for s in skins]

    def get_skin(self, skin_id: UUID) -> HeroSkinResponse:
        skin = self.skin_repo.get_by_id(skin_id)
        if not skin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy skin",
            )
        return self._skin_to_response(skin)

    async def create_skin(
        self,
        hero_id: UUID,
        payload: HeroSkinCreate,
        image: UploadFile,
    ) -> HeroSkinResponse:
        hero = self.hero_repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tướng",
            )

        skin_code = payload.skin_code or to_slug(payload.name)
        if not skin_code.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể sinh skin_code từ tên skin",
            )

        existing = self.skin_repo.get_by_skin_code(hero_id, skin_code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Skin code '{skin_code}' đã tồn tại trong tướng này",
            )

        # Validate image
        content_type = image.content_type or ""
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Định dạng ảnh không được hỗ trợ: {content_type}",
            )

        content = await image.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File ảnh quá lớn, tối đa 10MB",
            )

        ext = _ext_guard(image.filename or "image.png")
        object_name = f"skins/{hero.code}/{skin_code}-{uuid.uuid4()}{ext}"

        self.storage.save_bytes_to_path(
            content=content,
            object_name=object_name,
            content_type=content_type,
        )

        skin = HeroSkin(
            id=uuid.uuid4(),
            hero_id=hero_id,
            name=payload.name.strip(),
            skin_code=skin_code,
            image_object_name=object_name,
            status=payload.status,
            sort_order=payload.sort_order,
        )
        skin = self.skin_repo.create(skin)
        return self._skin_to_response(skin)

    async def update_skin(
        self,
        skin_id: UUID,
        payload: HeroSkinUpdate,
        image: Optional[UploadFile] = None,
    ) -> HeroSkinResponse:
        skin = self.skin_repo.get_by_id(skin_id)
        if not skin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy skin",
            )

        if payload.name is not None:
            stripped_name = payload.name.strip()
            if not stripped_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tên skin không được để trống",
                )
            skin.name = stripped_name

        if payload.skin_code is not None:
            stripped_code = payload.skin_code.strip()
            if stripped_code:
                existing = self.skin_repo.get_by_skin_code(
                    skin.hero_id, stripped_code
                )
                if existing and existing.id != skin_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Skin code '{stripped_code}' đã tồn tại trong tướng này",
                    )
                skin.skin_code = stripped_code
            else:
                skin.skin_code = to_slug(skin.name)

        if payload.status is not None:
            skin.status = payload.status

        if payload.sort_order is not None:
            skin.sort_order = payload.sort_order

        # If a new image is provided, upload it
        if image:
            content_type = image.content_type or ""
            if content_type not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Định dạng ảnh không được hỗ trợ: {content_type}",
                )

            content = await image.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File ảnh quá lớn, tối đa 10MB",
                )

            ext = _ext_guard(image.filename or "image.png")
            # Get hero code for path
            hero = self.hero_repo.get_by_id(skin.hero_id)
            hero_code = hero.code if hero else "unknown"
            object_name = f"skins/{hero_code}/{skin.skin_code}-{uuid.uuid4()}{ext}"

            self.storage.save_bytes_to_path(
                content=content,
                object_name=object_name,
                content_type=content_type,
            )

            # Optionally delete old image from MinIO (commented: MVP can skip)
            # try:
            #     self.storage.remove_object(skin.image_object_name)
            # except Exception:
            #     pass

            skin.image_object_name = object_name

        skin = self.skin_repo.update(skin)
        return self._skin_to_response(skin)

    def delete_skin(self, skin_id: UUID) -> None:
        skin = self.skin_repo.get_by_id(skin_id)
        if not skin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy skin",
            )

        # Optionally delete file from MinIO (MVP: can enable later)
        # try:
        #     self.storage.remove_object(skin.image_object_name)
        # except Exception:
        #     pass

        self.skin_repo.delete(skin)
