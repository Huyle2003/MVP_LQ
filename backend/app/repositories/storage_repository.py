from __future__ import annotations

from datetime import timedelta
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse, urlunparse
from uuid import uuid4
from minio import Minio
from minio.error import S3Error
from app.core.config import get_settings
from app.core.minio_client import get_minio_client


class StorageRepository:
    def __init__(self, client: Minio | None = None):
        self.settings = get_settings()
        self.client = client or get_minio_client()
        self.bucket = self.settings.minio_bucket
        self.ensure_bucket()

    def ensure_bucket(self) -> None:
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
        except S3Error as exc:
            raise RuntimeError(f"Cannot prepare MinIO bucket: {exc}") from exc

    def save_bytes(self, content: bytes, filename: str, content_type: str = "application/octet-stream") -> str:
        safe_name = filename.replace(" ", "_")
        object_name = f"uploads/{uuid4()}-{safe_name}"
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
        return object_name

    def save_result_bytes(self, content: bytes, filename: str = "result.png") -> str:
        object_name = f"results/{uuid4()}-{filename}"
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=BytesIO(content),
            length=len(content),
            content_type="image/png",
        )
        return object_name

    def read_bytes(self, object_name: str) -> bytes:
        response = self.client.get_object(self.bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def save_bytes_to_path(
        self, content: bytes, object_name: str, content_type: str = "application/octet-stream"
    ) -> str:
        """Save bytes to a custom object path in MinIO.

        Unlike save_bytes() which auto-generates a UUID path,
        this method uses the exact object_name provided.
        """
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
        return object_name

    def _replace_host(self, url: str) -> str:
        """Replace internal MinIO endpoint with public nginx proxy endpoint.

        From: http://minio:9000/bucket/object...
        To:   http://localhost:8088/minio/bucket/object...
        """
        internal = self.settings.minio_endpoint
        parsed = urlparse(url)
        if parsed.netloc == internal:
            public = self.settings.minio_public_endpoint
            # Prepend /minio to the path so nginx can proxy it
            new_path = f"/minio{parsed.path}"
            parsed = parsed._replace(netloc=public, path=new_path)
        return urlunparse(parsed)

    def list_objects(self, prefix: str = "") -> list[dict]:
        """List objects in the bucket with the given prefix."""
        try:
            objects = self.client.list_objects(self.bucket, prefix=prefix, recursive=True)
            result = []
            for obj in objects:
                result.append({
                    "object_name": obj.object_name,
                    "last_modified": obj.last_modified,
                })
            return result
        except S3Error as exc:
            raise RuntimeError(f"Cannot list objects: {exc}") from exc

    def delete_object(self, object_name: str) -> None:
        """Delete an object from MinIO."""
        try:
            self.client.remove_object(self.bucket, object_name)
        except S3Error as exc:
            raise RuntimeError(f"Cannot delete object {object_name}: {exc}") from exc

    def object_exists(self, object_name: str) -> bool:
        """Check if an object exists in MinIO."""
        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error:
            return False

    def copy_object(self, source_object: str, target_object: str) -> str:
        """Copy an object inside the bucket from source to target."""
        from minio.commonconfig import CopySource

        try:
            self.client.copy_object(
                bucket_name=self.bucket,
                object_name=target_object,
                source=CopySource(self.bucket, source_object),
            )
            return target_object
        except S3Error as exc:
            raise RuntimeError(f"Cannot copy {source_object} -> {target_object}: {exc}") from exc

    def presigned_url(self, object_name: str) -> str:
        """Legacy: generate presigned URL with host replacement.

        Kept for backward compatibility but should be replaced by preview_url().
        """
        url = self.client.presigned_get_object(
            bucket_name=self.bucket,
            object_name=object_name,
            expires=timedelta(hours=1),
        )
        return self._replace_host(url)

    def preview_url(self, object_name: str) -> str:
        """Generate a relative API URL for image preview via backend.

        Returns: /api/files/preview?object_name=<encoded_object_name>
        This works everywhere (localhost, Cloudflare Tunnel, VPS, custom domain).
        """
        from urllib.parse import quote
        return f"/api/files/preview?object_name={quote(object_name)}"
