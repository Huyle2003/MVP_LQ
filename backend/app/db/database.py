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
    """Create all tables if they don't exist, then seed default admin user and heroes."""
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

    _seed_heroes()

    from app.db.seed_catalog import seed_catalog_from_bundle
    seed_catalog_from_bundle()


def _seed_heroes():
    """Idempotently ensure every hero in seed_data.LIEN_QUAN_HEROES exists.

    Only inserts heroes missing by code — never touches existing rows, so
    skins/edits added later through the UI are never affected by this.
    """
    from app.db.models import Hero
    from app.db.seed_data import LIEN_QUAN_HEROES
    from app.utils.slug import to_slug

    db = SessionLocal()
    try:
        existing_codes = {code for (code,) in db.query(Hero.code).all()}
        created = 0
        for name in LIEN_QUAN_HEROES:
            code = to_slug(name)
            if code in existing_codes:
                continue
            db.add(Hero(name=name, code=code))
            existing_codes.add(code)
            created += 1
        if created:
            db.commit()
            print(f"[init_db] seeded {created} heroes", flush=True)
    except Exception as e:
        print(f"[init_db] hero seed error: {e}", flush=True)
    finally:
        db.close()
