"""One-off export: snapshot the current catalog (heroes' skins, buttons, kill
notifications, other images, counted images) into git-tracked files under
backend/seed_assets/ + backend/app/db/seed_catalog.json.

Re-run this any time you want the committed "starter data" to match what's
currently in the running app. It never touches the live DB/MinIO — read-only.

Run inside the api container (has DB/MinIO network access + deps):
    docker exec image_mvp_api python scripts/export_seed_bundle.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models import CountedImage, Hero, HeroSkin, OtherImage, SkinButton, SkinKillNotification
from app.repositories.storage_repository import StorageRepository

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed_assets")
MANIFEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "db", "seed_catalog.json"
)


def _ext(object_name: str) -> str:
    ext = os.path.splitext(object_name)[1]
    return ext if ext else ".png"


def _save_asset(storage: StorageRepository, object_name: str, relative_path: str) -> str:
    content = storage.read_bytes(object_name)
    full_path = os.path.join(ASSETS_DIR, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)
    return relative_path.replace(os.sep, "/")


def main():
    db = SessionLocal()
    storage = StorageRepository()
    manifest = {
        "hero_skins": [],
        "skin_buttons": [],
        "skin_kill_notifications": [],
        "other_images": [],
        "counted_images": [],
    }

    heroes_by_id = {h.id: h for h in db.query(Hero).all()}

    skins = db.query(HeroSkin).all()
    skins_by_id = {}
    for skin in skins:
        hero = heroes_by_id.get(skin.hero_id)
        if not hero:
            continue
        skins_by_id[skin.id] = (hero, skin)
        rel = f"hero_skins/{hero.code}/{skin.skin_code}{_ext(skin.image_object_name)}"
        asset = _save_asset(storage, skin.image_object_name, rel)
        manifest["hero_skins"].append({
            "hero_code": hero.code,
            "name": skin.name,
            "skin_code": skin.skin_code,
            "status": skin.status,
            "sort_order": skin.sort_order,
            "asset": asset,
        })

    for btn in db.query(SkinButton).all():
        pair = skins_by_id.get(btn.skin_id)
        if not pair:
            continue
        hero, skin = pair
        rel = f"skin_buttons/{hero.code}/{skin.skin_code}/{btn.code}{_ext(btn.image_object_name)}"
        asset = _save_asset(storage, btn.image_object_name, rel)
        manifest["skin_buttons"].append({
            "hero_code": hero.code,
            "skin_code": skin.skin_code,
            "name": btn.name,
            "code": btn.code,
            "status": btn.status,
            "sort_order": btn.sort_order,
            "asset": asset,
        })

    for ntf in db.query(SkinKillNotification).all():
        pair = skins_by_id.get(ntf.skin_id)
        if not pair:
            continue
        hero, skin = pair
        rel = f"skin_kill_notifications/{hero.code}/{skin.skin_code}/{ntf.code}{_ext(ntf.image_object_name)}"
        asset = _save_asset(storage, ntf.image_object_name, rel)
        manifest["skin_kill_notifications"].append({
            "hero_code": hero.code,
            "skin_code": skin.skin_code,
            "name": ntf.name,
            "code": ntf.code,
            "status": ntf.status,
            "sort_order": ntf.sort_order,
            "asset": asset,
        })

    for img in db.query(OtherImage).all():
        rel = f"other_images/{img.code}{_ext(img.image_object_name)}"
        asset = _save_asset(storage, img.image_object_name, rel)
        manifest["other_images"].append({
            "name": img.name,
            "code": img.code,
            "status": img.status,
            "sort_order": img.sort_order,
            "asset": asset,
        })

    for img in db.query(CountedImage).all():
        rel = f"counted_images/{img.code}{_ext(img.image_object_name)}"
        asset = _save_asset(storage, img.image_object_name, rel)
        manifest["counted_images"].append({
            "name": img.name,
            "code": img.code,
            "default_quantity": img.default_quantity,
            "status": img.status,
            "sort_order": img.sort_order,
            "asset": asset,
        })

    db.close()

    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    counts = {k: len(v) for k, v in manifest.items()}
    print(f"[export_seed_bundle] wrote {MANIFEST_PATH}")
    print(f"[export_seed_bundle] assets under {ASSETS_DIR}")
    print(f"[export_seed_bundle] counts: {counts}")


if __name__ == "__main__":
    main()
