import uuid
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import cv2
import numpy as np
from fastapi import HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from app.db.models import HeroSkin
from app.repositories.hero_repository import HeroRepository
from app.repositories.hero_skin_repository import HeroSkinRepository
from app.repositories.storage_repository import StorageRepository
from app.schemas.skin_crop_schema import (
    ManualCropConfig,
    AutoDetectResponse,
    AutoDetectItem,
    CardBoxResponse,
    CropResponse,
    CropItemResponse,
    CreateSkinFromCroppedRequest,
    RemoveBackgroundResponse,
)
from app.schemas.hero_skin_schema import HeroSkinResponse
from app.tasks.bg_remover import remove_background_flood_fill
from app.tasks.kill_notification_detector import detect_kill_notification_banners
from app.tasks.skin_button_detector import detect_skin_buttons
from app.tasks.skin_card_detector import (
    build_refine_context,
    detect_skin_cards,
    refine_column_left_edge,
    refine_row_top_edge,
)
from app.utils.slug import to_slug

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _ext_guard(filename: str) -> str:
    import os
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng file không được hỗ trợ: {ext}. Chỉ chấp nhận jpg, jpeg, png, webp",
        )
    return ext


def _content_type_guard(content_type: Optional[str]) -> str:
    ct = (content_type or "").lower()
    if ct not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng ảnh không được hỗ trợ: {ct}",
        )
    return ct


class SkinCropService:
    def __init__(self, db: Optional[Session] = None, storage: Optional[StorageRepository] = None):
        self.storage = storage or StorageRepository()
        self.db = db

    async def auto_detect_and_crop(
        self,
        file: UploadFile,
        card_width: int = 325,
        card_height: int = 515,
        gap_x: int = 25,
        row_count: int = 1,
        count_per_row: int = 5,
        start_x: int = 702,
    ) -> AutoDetectResponse:
        _content_type_guard(file.content_type)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File ảnh quá lớn, tối đa 20MB")

        try:
            boxes, orig_w, orig_h = detect_skin_cards(
                content,
                card_width=card_width,
                card_height=card_height,
                gap_x=gap_x,
                row_count=row_count,
                count_per_row=count_per_row,
                start_x=start_x,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        if not boxes:
            return AutoDetectResponse(image_width=orig_w, image_height=orig_h, detected_count=0, items=[])

        img_array = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc ảnh")

        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        items: list[AutoDetectItem] = []

        for i, box in enumerate(boxes):
            crop = img[box.y: box.y + box.height, box.x: box.x + box.width]
            if crop.size == 0:
                continue
            success, buf = cv2.imencode(".png", crop)
            if not success:
                continue
            object_name = f"skin-crops/{date_path}/{uuid.uuid4()}.png"
            self.storage.save_bytes_to_path(content=buf.tobytes(), object_name=object_name, content_type="image/png")
            image_url = self.storage.preview_url(object_name)
            items.append(AutoDetectItem(
                index=i + 1,
                object_name=object_name,
                image_url=image_url,
                box=CardBoxResponse(x=box.x, y=box.y, width=box.width, height=box.height),
            ))

        return AutoDetectResponse(image_width=orig_w, image_height=orig_h, detected_count=len(items), items=items)

    async def auto_detect_notifications(
        self,
        file: UploadFile,
        card_width: int = 325,
        card_height: int = 515,
        gap_x: int = 25,
        row_count: int = 1,
        count_per_row: int = 4,
        start_x: int = 702,
    ) -> AutoDetectResponse:
        """Locate kill-notification banners using the card grid's fixed
        geometry (see tasks/kill_notification_detector.py). The generic
        skin-card detector isn't used here: it searches for the best-scoring
        Y, and inside these screenshots the card's own top edge outscores the
        banner (flat page background above it vs. detailed artwork above the
        banner), so it reliably locks onto the wrong line.

        card_width/card_height/gap_x/row_count/start_x are accepted for
        endpoint compatibility but ignored — the geometry is derived from the
        image itself."""
        _content_type_guard(file.content_type)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File ảnh quá lớn, tối đa 20MB")

        try:
            boxes, orig_w, orig_h = detect_kill_notification_banners(
                content, count_per_row=count_per_row
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        return self._crop_boxes_to_response(content, boxes, orig_w, orig_h)

    async def auto_detect_buttons(
        self,
        file: UploadFile,
        count_per_row: int = 4,
    ) -> AutoDetectResponse:
        """Locate skin button icons using the card grid's fixed geometry
        (see tasks/skin_button_detector.py)."""
        _content_type_guard(file.content_type)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File ảnh quá lớn, tối đa 20MB")

        try:
            boxes, orig_w, orig_h = detect_skin_buttons(content, count_per_row=count_per_row)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        return self._crop_boxes_to_response(content, boxes, orig_w, orig_h)

    def _crop_boxes_to_response(self, content: bytes, boxes, orig_w: int, orig_h: int) -> AutoDetectResponse:
        """Slice the detected boxes out of the source image and store them."""
        if not boxes:
            return AutoDetectResponse(image_width=orig_w, image_height=orig_h, detected_count=0, items=[])

        img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc ảnh")

        date_path = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        items: list[AutoDetectItem] = []
        for i, box in enumerate(boxes):
            crop = img[box.y: box.y + box.height, box.x: box.x + box.width]
            if crop.size == 0:
                continue
            success, buf = cv2.imencode(".png", crop)
            if not success:
                continue
            object_name = f"skin-crops/{date_path}/{uuid.uuid4()}.png"
            self.storage.save_bytes_to_path(content=buf.tobytes(), object_name=object_name, content_type="image/png")
            items.append(AutoDetectItem(
                index=i + 1,
                object_name=object_name,
                image_url=self.storage.preview_url(object_name),
                box=CardBoxResponse(x=box.x, y=box.y, width=box.width, height=box.height),
            ))

        return AutoDetectResponse(
            image_width=orig_w, image_height=orig_h, detected_count=len(items), items=items
        )

    async def manual_crop_image(self, file: UploadFile, config: ManualCropConfig) -> CropResponse:
        _content_type_guard(file.content_type)

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File ảnh quá lớn, tối đa 20MB")

        img_array = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể đọc ảnh")

        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        items: list[CropItemResponse] = []
        idx = 0

        # When refining, each row/column predicts its position from the
        # PREVIOUS refined one rather than from start_x/start_y — otherwise
        # an off-by-N starting guess (plus any per-step stride error) keeps
        # accumulating, and by the last column the true edge has drifted
        # outside refine_window entirely and can no longer be recovered.
        prev_row_top: Optional[int] = None
        refine_ctx = build_refine_context(img) if (config.refine_x or config.refine_y) else None

        for row in range(config.row_count):
            if config.refine_y and prev_row_top is not None:
                row_top = prev_row_top + config.card_height + config.gap_x
            else:
                row_top = config.start_y + row * (config.card_height + config.gap_x)
            if config.refine_y and refine_ctx is not None:
                # Refine Y once per row (measured at the row's first column,
                # whose X the user lined up against) and reuse it for every
                # column — the whole row shares one top edge, so refining it
                # per-column would just let noise pull cards out of line.
                row_top = refine_row_top_edge(
                    refine_ctx, config.start_x, row_top, config.card_width, config.card_height, config.refine_window
                )
            prev_row_top = row_top

            prev_left: Optional[int] = None
            for col in range(config.count_per_row):
                if config.refine_x and prev_left is not None:
                    left = prev_left + config.card_width + config.gap_x
                else:
                    left = config.start_x + col * (config.card_width + config.gap_x)
                top = row_top
                if config.refine_x and refine_ctx is not None:
                    left = refine_column_left_edge(
                        refine_ctx, left, top, config.card_width, config.card_height, config.refine_window
                    )
                    prev_left = left
                right = left + config.card_width
                bottom = top + config.card_height
                if right > img.shape[1] or bottom > img.shape[0]:
                    continue
                crop = img[top:bottom, left:right]
                if crop.size == 0:
                    continue
                success, buf = cv2.imencode(".png", crop)
                if not success:
                    continue
                idx += 1
                object_name = f"skin-crops/{date_path}/{uuid.uuid4()}.png"
                self.storage.save_bytes_to_path(content=buf.tobytes(), object_name=object_name, content_type="image/png")
                image_url = self.storage.preview_url(object_name)
                items.append(CropItemResponse(index=idx, object_name=object_name, image_url=image_url))

        return CropResponse(items=items)

    def remove_background(self, object_name: str, tolerance: int = 24) -> RemoveBackgroundResponse:
        if not self.storage.object_exists(object_name):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy ảnh đã cắt")

        content = self.storage.read_bytes(object_name)
        try:
            result_bytes = remove_background_flood_fill(content, tolerance=tolerance)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

        now = datetime.now(timezone.utc)
        date_path = now.strftime("%Y/%m/%d")
        new_object_name = f"skin-crops/{date_path}/{uuid.uuid4()}-nobg.png"
        self.storage.save_bytes_to_path(content=result_bytes, object_name=new_object_name, content_type="image/png")
        return RemoveBackgroundResponse(object_name=new_object_name, image_url=self.storage.preview_url(new_object_name))

    def delete_crop(self, object_name: str) -> None:
        if not self.storage.object_exists(object_name):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy object {object_name} trên MinIO",
            )
        self.storage.delete_object(object_name)

    def _skin_to_response(self, skin: HeroSkin) -> HeroSkinResponse:
        image_url = self.storage.preview_url(skin.image_object_name)
        preview_url = None
        if skin.preview_object_name:
            preview_url = self.storage.preview_url(skin.preview_object_name)
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

    def create_skin_from_cropped(self, hero_id: UUID, request: CreateSkinFromCroppedRequest) -> HeroSkinResponse:
        if self.db is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database session required")

        hero_repo = HeroRepository(self.db)
        hero = hero_repo.get_by_id(hero_id)
        if not hero:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy tướng")

        if not self.storage.object_exists(request.cropped_object_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ảnh đã cắt {request.cropped_object_name} không tồn tại trên MinIO",
            )

        skin_code = request.skin_code or to_slug(request.name)
        if not skin_code.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Không thể sinh skin_code từ tên skin")

        skin_repo = HeroSkinRepository(self.db)
        existing = skin_repo.get_by_skin_code(hero_id, skin_code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Skin code '{skin_code}' đã tồn tại trong tướng này",
            )

        import os as _os
        _, ext = _os.path.splitext(request.cropped_object_name)
        if not ext:
            ext = ".png"
        target_object = f"skins/{hero.code}/{skin_code}-{uuid.uuid4()}{ext}"

        self.storage.copy_object(source_object=request.cropped_object_name, target_object=target_object)

        skin = HeroSkin(
            id=uuid.uuid4(),
            hero_id=hero_id,
            name=request.name.strip(),
            skin_code=skin_code,
            image_object_name=target_object,
            status=request.status,
            sort_order=request.sort_order,
        )
        skin = skin_repo.create(skin)
        return self._skin_to_response(skin)