import json
from uuid import UUID, uuid4
from fastapi import HTTPException
from app.core.redis_client import get_redis_client
from app.domain.job_status import JobStatus
from app.repositories.storage_repository import StorageRepository
from app.schemas.compose_schema import (
    ComposeRequest,
    SkinBoardComposeRequest,
    ComposeResponse,
    JobResponse,
)


class JobService:
    QUEUE_KEY = "image_jobs"

    def __init__(self):
        self.redis = get_redis_client()
        self.storage = StorageRepository()

    def create_compose_job(self, request: ComposeRequest) -> ComposeResponse:
        job_id = str(uuid4())

        job_data = {
            "job_id": job_id,
            "type": "SIMPLE_COMPOSE",
            "status": JobStatus.PENDING,
            "background_object": request.background_object,
            "overlay_object": request.overlay_object,
            "x": request.x,
            "y": request.y,
            "width": request.width,
            "opacity": request.opacity,
            "result_object": None,
            "error": None,
        }

        self.redis.set(f"job:{job_id}", json.dumps(job_data))
        self.redis.rpush(self.QUEUE_KEY, job_id)

        return ComposeResponse(job_id=job_id, status=JobStatus.PENDING)

    def create_skin_board_job(self, request: SkinBoardComposeRequest) -> ComposeResponse:
        # Validate compose_mode
        for item in request.items:
            if item.compose_mode != "inside_skin":
                raise HTTPException(
                    status_code=400,
                    detail=f"Kiểu ghép '{item.compose_mode}' chưa hỗ trợ",
                )

        job_id = str(uuid4())

        def _uuid_to_str(d):
            """Convert UUID objects to strings recursively."""
            if isinstance(d, dict):
                return {k: _uuid_to_str(v) for k, v in d.items()}
            elif isinstance(d, list):
                return [_uuid_to_str(v) for v in d]
            elif isinstance(d, UUID):
                return str(d)
            return d

        items_dict = [_uuid_to_str(item.model_dump()) for item in request.items]

        win_rate_items = []
        if request.options.win_rate_enabled:
            win_rate_items = [item.model_dump() for item in request.win_rate_items]

        job_data = {
            "job_id": job_id,
            "type": "SKIN_BOARD_COMPOSE",
            "compose_type": request.compose_type,
            "status": JobStatus.PENDING,
            "background_object": request.background_object,
            "items": items_dict,
            "win_rate_items": win_rate_items,
            "options": request.options.model_dump(),
            "editor": request.editor.model_dump() if request.editor else None,
            "result_object": None,
            "error": None,
        }

        self.redis.set(f"job:{job_id}", json.dumps(job_data))
        self.redis.rpush(self.QUEUE_KEY, job_id)

        return ComposeResponse(job_id=job_id, status=JobStatus.PENDING)

    def get_job(self, job_id: str) -> JobResponse:
        raw = self.redis.get(f"job:{job_id}")
        if not raw:
            return JobResponse(job_id=job_id, status="NOT_FOUND")

        data = json.loads(raw)
        result_object = data.get("result_object")
        result_url = self.storage.presigned_url(result_object) if result_object else None

        return JobResponse(
            job_id=job_id,
            status=data.get("status", "UNKNOWN"),
            result_object=result_object,
            result_url=result_url,
            error=data.get("error"),
        )
