from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Image Composer MVP"
    env: str = "development"

    backend_cors_origins: str = "http://localhost:3100,http://localhost:8088"

    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0
    redis_url: str = "redis://redis:6379/0"

    minio_endpoint: str = "minio:9000"
    minio_public_endpoint: str = "localhost:8088"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket: str = "image-composer"
    minio_secure: bool = False

    jwt_private_key_path: str = "/app/private.pem"
    jwt_public_key_path: str = "/app/public.pem"
    jwt_algorithm: str = "RS256"
    jwt_expire_minutes: int = 1440

    database_url: str = "postgresql://postgres:postgres@postgres:5432/image_composer"

    admin_email: str = "admin@gmail.com"
    admin_password: str = "123456"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
