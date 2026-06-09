from fastapi import APIRouter, Depends, File, UploadFile

from app.core.security import get_current_user
from app.schemas.upload_schema import UploadResponse
from app.services.upload_service import UploadService

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])


@router.post("", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    service = UploadService()
    return await service.upload_image(file)
