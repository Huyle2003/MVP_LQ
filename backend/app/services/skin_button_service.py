import uuid
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from app.db.models import SkinButton
from app.repositories.hero_repository import HeroRepository
from app.repositories.hero_skin_repository import HeroSkinRepository
from app.repositories.skin_button_repository import SkinButtonRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.skin_button_schema import (
    SkinButtonCreate, SkinButtonUpdate, SkinButtonResponse,
)
from app.utils.slug import to_slug

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def _validate_and_read(file: UploadFile) -> bytes:
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Định dạng ảnh không hỗ trợ: {ct}")
    import os
    ext = os.path.splitext(file.filename or "image.png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Định dạng file không hỗ trợ: {ext}")
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File ảnh quá lớn, tối đa 10MB")
    return content, ext, ct


class SkinButtonService:
    def __init__(self, db: Session, storage: Optional[StorageRepository] = None):
        self.repo = SkinButtonRepository(db)
        self.hero_skin_repo = HeroSkinRepository(db)
        self.hero_repo = HeroRepository(db)
        self.storage = storage or StorageRepository()
        self.db = db

    def _enrich(self, btn: SkinButton) -> SkinButtonResponse:
        skin = self.hero_skin_repo.get_by_id(btn.skin_id)
        hero = self.hero_repo.get_by_id(skin.hero_id) if skin else None
        return SkinButtonResponse(
            id=btn.id,
            skin_id=btn.skin_id,
            skin_name=skin.name if skin else None,
            hero_id=skin.hero_id if skin else None,
            hero_name=hero.name if hero else None,
            name=btn.name,
            code=btn.code,
            image_object_name=btn.image_object_name,
            image_url=self.storage.preview_url(btn.image_object_name),
            status=btn.status,
            sort_order=btn.sort_order,
            created_at=btn.created_at,
            updated_at=btn.updated_at,
        )

    def list(self, keyword=None, hero_id=None, skin_id=None, status=None):
        items = self.repo.list(keyword, hero_id, skin_id, status)
        return [self._enrich(i) for i in items]

    def get(self, button_id: UUID) -> SkinButtonResponse:
        btn = self.repo.get_by_id(button_id)
        if not btn:
            raise HTTPException(status_code=404, detail="Không tìm thấy nút bấm")
        return self._enrich(btn)

    async def create(self, payload: SkinButtonCreate, image: UploadFile) -> SkinButtonResponse:
        skin = self.hero_skin_repo.get_by_id(payload.skin_id)
        if not skin:
            raise HTTPException(status_code=404, detail="Không tìm thấy skin")
        hero = self.hero_repo.get_by_id(skin.hero_id)
        hero_code = hero.code if hero else "unknown"
        skin_code = skin.skin_code

        code = payload.code or to_slug(payload.name)
        if not code:
            raise HTTPException(status_code=400, detail="Không thể sinh code từ tên")

        if self.repo.get_by_code(payload.skin_id, code):
            raise HTTPException(status_code=409, detail=f"Code '{code}' đã tồn tại trong skin này")

        content, ext, ct = _validate_and_read(image)
        object_name = f"skin-buttons/{hero_code}/{skin_code}/{code}-{uuid.uuid4()}{ext}"
        self.storage.save_bytes_to_path(content, object_name, ct)

        btn = SkinButton(id=uuid.uuid4(), skin_id=payload.skin_id, name=payload.name.strip(),
                         code=code, image_object_name=object_name, status=payload.status,
                         sort_order=payload.sort_order)
        btn = self.repo.create(btn)
        return self._enrich(btn)

    async def update(self, button_id: UUID, payload: SkinButtonUpdate, image: Optional[UploadFile] = None) -> SkinButtonResponse:
        btn = self.repo.get_by_id(button_id)
        if not btn:
            raise HTTPException(status_code=404, detail="Không tìm thấy nút bấm")

        if payload.skin_id is not None:
            skin = self.hero_skin_repo.get_by_id(payload.skin_id)
            if not skin:
                raise HTTPException(status_code=404, detail="Không tìm thấy skin")
            btn.skin_id = payload.skin_id

        if payload.name is not None:
            btn.name = payload.name.strip()
        if payload.code is not None:
            code = payload.code.strip() or to_slug(btn.name)
            existing = self.repo.get_by_code(btn.skin_id, code)
            if existing and existing.id != button_id:
                raise HTTPException(status_code=409, detail=f"Code '{code}' đã tồn tại")
            btn.code = code
        if payload.status is not None:
            btn.status = payload.status
        if payload.sort_order is not None:
            btn.sort_order = payload.sort_order

        if image and image.filename:
            content, ext, ct = _validate_and_read(image)
            skin = self.hero_skin_repo.get_by_id(btn.skin_id)
            hero = self.hero_repo.get_by_id(skin.hero_id) if skin else None
            hero_code = hero.code if hero else "unknown"
            skin_code = skin.skin_code if skin else "unknown"
            object_name = f"skin-buttons/{hero_code}/{skin_code}/{btn.code}-{uuid.uuid4()}{ext}"
            self.storage.save_bytes_to_path(content, object_name, ct)
            btn.image_object_name = object_name

        btn = self.repo.update(btn)
        return self._enrich(btn)

    def delete(self, button_id: UUID) -> None:
        btn = self.repo.get_by_id(button_id)
        if not btn:
            raise HTTPException(status_code=404, detail="Không tìm thấy nút bấm")
        self.repo.delete(btn)
