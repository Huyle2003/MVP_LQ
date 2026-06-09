from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.compose import router as compose_router
from app.api.routes.heroes import router as heroes_router
from app.api.routes.hero_skins import router as hero_skins_router
from app.api.routes.skin_crop import router as skin_crop_router
from app.api.routes.skin_buttons import router as skin_buttons_router
from app.api.routes.skin_kill_notifications import router as skin_kill_notifications_router
from app.api.routes.other_images import router as other_images_router
from app.api.routes.counted_images import router as counted_images_router
from app.core.config import get_settings
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    init_db()
    yield


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Image Composer MVP API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(uploads_router)
app.include_router(compose_router)
app.include_router(heroes_router)
app.include_router(hero_skins_router)
app.include_router(skin_crop_router)
app.include_router(skin_buttons_router)
app.include_router(skin_kill_notifications_router)
app.include_router(other_images_router)
app.include_router(counted_images_router)
