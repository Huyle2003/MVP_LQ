from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.compose_schema import (
    ComposeRequest,
    SkinBoardComposeRequest,
    ComposeResponse,
    JobResponse,
)
from app.services.job_service import JobService

router = APIRouter(tags=["Compose"])


@router.post("/api/compose", response_model=ComposeResponse)
def compose_image(
    request: ComposeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Legacy: compose a single overlay image onto a background."""
    service = JobService()
    return service.create_compose_job(request)


@router.post("/api/compose/skin-board", response_model=ComposeResponse)
def compose_skin_board(
    request: SkinBoardComposeRequest,
    current_user: dict = Depends(get_current_user),
):
    """New: compose a background + multiple skin images in a row."""
    service = JobService()
    return service.create_skin_board_job(request)


@router.get("/api/jobs/{job_id}", response_model=JobResponse)
def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    service = JobService()
    return service.get_job(job_id)
