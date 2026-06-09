import redis
from app.core.config import get_settings


def get_redis_client() -> redis.Redis:
    settings = get_settings()
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db,
        decode_responses=True,
    )
