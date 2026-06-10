from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from io import BytesIO
import mimetypes

from app.repositories.storage_repository import StorageRepository

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/preview")
def preview_file(object_name: str = Query(...)):
    if not object_name or ".." in object_name:
        raise HTTPException(status_code=400, detail="object_name không hợp lệ")

    try:
        storage = StorageRepository()
        data = storage.read_bytes(object_name)

        content_type, _ = mimetypes.guess_type(object_name)
        if not content_type:
            content_type = "application/octet-stream"

        return StreamingResponse(
            BytesIO(data),
            media_type=content_type,
        )

    except Exception as e:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy file: {str(e)}"
        )
