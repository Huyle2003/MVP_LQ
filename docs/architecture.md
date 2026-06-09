# Architecture

## Modules

### Backend

- `api/routes`: định nghĩa endpoint.
- `core`: config, redis, minio setting.
- `repositories`: làm việc với MinIO.
- `services`: nghiệp vụ upload, compose, job.
- `schemas`: request/response DTO.
- `tasks`: logic xử lý ảnh có thể dùng chung với worker.

### Frontend

- `pages`: màn hình chính.
- `components`: component UI.
- `services`: hàm gọi API.
- `styles`: CSS.
- `utils`: helper.

### Worker

Worker chạy nền, lấy job từ Redis, đọc ảnh từ MinIO, xử lý bằng Pillow và ghi kết quả về MinIO.

## Development ports

| Service | Port |
|---|---:|
| Frontend | 3000 |
| Backend | 8000 |
| Nginx | 80 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
