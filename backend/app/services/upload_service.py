from fastapi import UploadFile
from app.repositories.storage_repository import StorageRepository
from app.schemas.upload_schema import UploadResponse


class UploadService:
    def __init__(self, storage: StorageRepository | None = None):
        self.storage = storage or StorageRepository()

    async def upload_image(self, file: UploadFile) -> UploadResponse:
        content = await file.read()
        object_name = self.storage.save_bytes(
            content=content,
            filename=file.filename or "image.png",
            content_type=file.content_type or "application/octet-stream",
        )
        return UploadResponse(
            object_name=object_name,
            file_url=self.storage.preview_url(object_name),
        )
