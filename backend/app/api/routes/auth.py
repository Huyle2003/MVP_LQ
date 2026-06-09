from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.redis_client import get_redis_client
from app.core.security import get_current_user, require_admin
from app.db.database import get_db
from app.db.models import User
from app.schemas.auth_schema import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    UserCreateRequest,
    UserFullResponse,
    UserUpdateRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    service = AuthService(db)
    return service.login(request)


@router.post("/register", response_model=LoginResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    service = AuthService(db)
    return service.register(request)


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ─── Heartbeat / Online tracking ────────────────

@router.post("/heartbeat")
def heartbeat(current_user: dict = Depends(get_current_user)):
    r = get_redis_client()
    key = f"online:{current_user['id']}"
    r.setex(key, 300, datetime.now(timezone.utc).isoformat())
    return {"status": "ok"}


@router.get("/online")
def get_online_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    r = get_redis_client()
    keys = r.keys("online:*")
    online_ids = [(k.decode() if isinstance(k, bytes) else k).replace("online:", "") for k in keys]
    if not online_ids:
        return []
    from uuid import UUID
    result = []
    for oid in online_ids:
        u = db.query(User).filter(User.id == UUID(oid)).first()
        if u:
            result.append({"id": str(u.id), "email": u.email, "role": u.role})
    return result


# ─── Admin: User management ──────────────────────


@router.get("/users", response_model=list[UserFullResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.post("/users", response_model=UserFullResponse, status_code=201)
def create_user(
    request: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    import bcrypt
    pw_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db_user = User(
        email=request.email,
        password_hash=pw_hash,
        role=request.role,
        status=request.status,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/users/{user_id}", response_model=UserFullResponse)
def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    from fastapi import HTTPException
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")

    if request.email is not None:
        dup = db.query(User).filter(User.email == request.email, User.id != user_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="Email đã tồn tại")
        db_user.email = request.email
    if request.password is not None:
        import bcrypt
        db_user.password_hash = bcrypt.hashpw(request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    if request.role is not None:
        db_user.role = request.role
    if request.status is not None:
        db_user.status = request.status

    db.commit()
    db.refresh(db_user)
    return db_user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    from fastapi import HTTPException
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user")
    db.delete(db_user)
    db.commit()
