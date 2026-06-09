from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist, then seed default admin user."""
    Base.metadata.create_all(bind=engine)

    # Seed default admin account
    from app.db.models import User
    import bcrypt
    db = SessionLocal()
    try:
        email = "ledanghuy273.admin@gmail.com"
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            pw_hash = bcrypt.hashpw(b"Huy@Admin473", bcrypt.gensalt()).decode("utf-8")
            admin = User(
                email=email,
                password_hash=pw_hash,
                role="ADMIN",
                status="ACTIVE",
            )
            db.add(admin)
            db.commit()
            print("[init_db] seeded admin account: ledanghuy273.admin@gmail.com", flush=True)
    except Exception as e:
        print(f"[init_db] seed error: {e}", flush=True)
    finally:
        db.close()
