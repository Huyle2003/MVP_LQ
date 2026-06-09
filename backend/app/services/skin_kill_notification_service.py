import uuid
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from app.db.models import SkinKillNotification
from app.repositories.hero_repository import HeroRepository
from app.repositories.hero_skin_repository import HeroSkinRepository
from app.repositories.skin_kill_notification_repository import SkinKillNotificationRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.skin_kill_notification_schema import (
    SkinKillNotificationCreate, SkinKillNotificationUpdate, SkinKillNotificationResponse,
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


class SkinKillNotificationService:
    def __init__(self, db: Session, storage: Optional[StorageRepository] = None):
        self.repo = SkinKillNotificationRepository(db)
        self.hero_skin_repo = HeroSkinRepository(db)
        self.hero_repo = HeroRepository(db)
        self.storage = storage or StorageRepository()
        self.db = db

    def _enrich(self, ntf: SkinKillNotification) -> SkinKillNotificationResponse:
        skin = self.hero_skin_repo.get_by_id(ntf.skin_id)
        hero = self.hero_repo.get_by_id(skin.hero_id) if skin else None
        return SkinKillNotificationResponse(
            id=ntf.id,
            skin_id=ntf.skin_id,
            skin_name=skin.name if skin else None,
            hero_id=skin.hero_id if skin else None,
            hero_name=hero.name if hero else None,
            name=ntf.name,
            code=ntf.code,
            image_object_name=ntf.image_object_name,
            image_url=self.storage.presigned_url(ntf.image_object_name),
            status=ntf.status,
            sort_order=ntf.sort_order,
            created_at=ntf.created_at,
            updated_at=ntf.updated_at,
        )

    def list(self, keyword=None, hero_id=None, skin_id=None, status=None):
        items = self.repo.list(keyword, hero_id, skin_id, status)
        return [self._enrich(i) for i in items]

    def get(self, ntf_id: UUID) -> SkinKillNotificationResponse:
        ntf = self.repo.get_by_id(ntf_id)
        if not ntf:
            raise HTTPException(status_code=404, detail="Không tìm thấy thông báo hạ")
        return self._enrich(ntf)

    async def create(self, payload: SkinKillNotificationCreate, image: UploadFile) -> SkinKillNotificationResponse:
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
        object_name = f"skin-kill-notifications/{hero_code}/{skin_code}/{code}-{uuid.uuid4()}{ext}"
        self.storage.save_bytes_to_path(content, object_name, ct)

        ntf = SkinKillNotification(id=uuid.uuid4(), skin_id=payload.skin_id, name=payload.name.strip(),
                                    code=code, image_object_name=object_name, status=payload.status,
                                    sort_order=payload.sort_order)
        ntf = self.repo.create(ntf)
        return self._enrich(ntf)

    async def update(self, ntf_id: UUID, payload: SkinKillNotificationUpdate, image: Optional[UploadFile] = None) -> SkinKillNotificationResponse:
        ntf = self.repo.get_by_id(ntf_id)
        if not ntf:
            raise HTTPException(status_code=404, detail="Không tìm thấy thông báo hạ")

        if payload.skin_id is not None:
            skin = self.hero_skin_repo.get_by_id(payload.skin_id)
            if not skin:
                raise HTTPException(status_code=404, detail="Không tìm thấy skin")
            ntf.skin_id = payload.skin_id

        if payload.name is not None:
            ntf.name = payload.name.strip()
        if payload.code is not None:
            code = payload.code.strip() or to_slug(ntf.name)
            existing = self.repo.get_by_code(ntf.skin_id, code)
            if existing and existing.id != ntf_id:
                raise HTTPException(status_code=409, detail=f"Code '{code}' đã tồn tại")
            ntf.code = code
        if payload.status is not None:
            ntf.status = payload.status
        if payload.sort_order is not None:
            ntf.sort_order = payload.sort_order

        if image and image.filename:
            content, ext, ct = _validate_and_read(image)
            skin = self.hero_skin_repo.get_by_id(ntf.skin_id)
            hero = self.hero_repo.get_by_id(skin.hero_id) if skin else None
            hero_code = hero.code if hero else "unknown"
            skin_code = skin.skin_code if skin else "unknown"
            object_name = f"skin-kill-notifications/{hero_code}/{skin_code}/{ntf.code}-{uuid.uuid4()}{ext}"
            self.storage.save_bytes_to_path(content, object_name, ct)
            ntf.image_object_name = object_name

        ntf = self.repo.update(ntf)
        return self._enrich(ntf)

    def delete(self, ntf_id: UUID) -> None:
        ntf = self.repo.get_by_id(ntf_id)
        if not ntf:
            raise HTTPException(status_code=404, detail="Không tìm thấy thông báo hạ")
        self.repo.delete(ntf)
