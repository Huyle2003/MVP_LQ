import os
import uuid
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import OtherImage
from app.repositories.other_image_repository import OtherImageRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.other_image_schema import (
    OtherImageCreate,
    OtherImageResponse,
    OtherImageUpdate,
)
from app.utils.slug import to_slug

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


def _validate_and_read(file: UploadFile) -> tuple[bytes, str, str]:
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Định dạng ảnh không hỗ trợ: {ct}")
    ext = os.path.splitext(file.filename or "image.png")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Định dạng file không hỗ trợ: {ext}")
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File ảnh quá lớn, tối đa 10MB")
    return content, ext, ct


def _image_object_name(code: str, ext: str) -> str:
    return f"other-images/{code}-{uuid.uuid4().hex[:8]}{ext}"


class OtherImageService:
    def __init__(self, db: Session, storage: Optional[StorageRepository] = None):
        self.repo = OtherImageRepository(db)
        self.storage = storage or StorageRepository()
        self.db = db

    def _enrich(self, item: OtherImage) -> OtherImageResponse:
        return OtherImageResponse(
            id=item.id,
            name=item.name,
            code=item.code,
            image_object_name=item.image_object_name,
            image_url=self.storage.preview_url(item.image_object_name),
            status=item.status,
            sort_order=item.sort_order,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def list(self, keyword: Optional[str] = None, status: Optional[str] = None) -> list[OtherImageResponse]:
        items = self.repo.list(keyword=keyword, status=status)
        return [self._enrich(i) for i in items]

    def get(self, item_id: UUID) -> OtherImageResponse:
        item = self.repo.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
        return self._enrich(item)

    async def create(self, payload: OtherImageCreate, image: UploadFile) -> OtherImageResponse:
        content, ext, ct = _validate_and_read(image)
        code = (payload.code or "").strip() or to_slug(payload.name)
        # Ensure code is unique
        existing = self.repo.get_by_code(code)
        if existing:
            raise HTTPException(status_code=400, detail=f"Mã '{{code}}' đã tồn tại")
        object_name = _image_object_name(code, ext)
        self.storage.save_bytes_to_path(content=content, object_name=object_name, content_type=ct)
        item = OtherImage(
            name=payload.name,
            code=code,
            image_object_name=object_name,
            status=payload.status,
            sort_order=payload.sort_order,
        )
        item = self.repo.create(item)
        return self._enrich(item)

    async def update(self, item_id: UUID, payload: OtherImageUpdate, image: Optional[UploadFile] = None) -> OtherImageResponse:
        item = self.repo.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")

        if payload.name is not None:
            item.name = payload.name
        if payload.code is not None:
            new_code = payload.code.strip() or to_slug(item.name)
            duplicate = self.repo.get_by_code(new_code)
            if duplicate and duplicate.id != item_id:
                raise HTTPException(status_code=400, detail=f"Mã '{{new_code}}' đã tồn tại")
            item.code = new_code
        if payload.status is not None:
            item.status = payload.status
        if payload.sort_order is not None:
            item.sort_order = payload.sort_order

        if image:
            content, ext, ct = _validate_and_read(image)
            object_name = _image_object_name(item.code, ext)
            self.storage.save_bytes_to_path(content=content, object_name=object_name, content_type=ct)
            # Delete old object
            try:
                self.storage.delete_object(item.image_object_name)
            except Exception:
                pass
            item.image_object_name = object_name

        item = self.repo.update(item)
        return self._enrich(item)

    def delete(self, item_id: UUID) -> None:
        item = self.repo.get_by_id(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")
        try:
            self.storage.delete_object(item.image_object_name)
        except Exception:
            pass
        self.repo.delete(item)
