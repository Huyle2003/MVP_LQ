# Image Composer Auth Layout MVP

Bản này đã có:

- Backend FastAPI chạy port `8100`
- Frontend React + Vite chạy port `3100`
- Login JWT RS256 bằng `private.pem` và `public.pem`
- Layout sau login gồm sidebar, topbar, thông tin tài khoản và logout
- Các trang:
  - Trang chủ
  - Quản lý user
  - Ghép skin
  - Danh mục ảnh skin
  - Danh mục nút bấm
  - Danh mục thông báo hạ
- Worker Python xử lý ảnh
- Redis queue
- MinIO lưu ảnh
- Nginx port `8088`

## Chạy project

Copy key JWT vào thư mục backend:

```txt
backend/private.pem
backend/public.pem
```

Tạo `.env`:

```powershell
copy .env.example .env
```

Chạy:

```powershell
docker compose up -d --build
```

## Link

```txt
Frontend:      http://localhost:3100
Backend docs:  http://localhost:8100/docs
Nginx:         http://localhost:8088
MinIO Console: http://localhost:9101
```

## Tài khoản demo

```txt
Email: admin@gmail.com
Password: 123456
```

## Docker ports

```txt
image_mvp_api        8100:8000
image_mvp_frontend   3100:3000
image_mvp_nginx      8088:80
image_mvp_redis      6380:6379
image_mvp_minio      9100:9000, 9101:9001
image_mvp_worker     chạy nền
```
