"""Idempotently restore the catalog snapshot produced by
scripts/export_seed_bundle.py (backend/app/db/seed_catalog.json +
backend/seed_assets/). Runs on every app startup via init_db().

Only inserts rows that don't already exist (matched by their natural key —
skin_code per hero, code per skin/other-image/counted-image), so it's safe
to run repeatedly and never disturbs data added later through the app.
"""
import json
import os
import uuid
from pathlib import Path

from app.db.database import SessionLocal
from app.db.models import CountedImage, Hero, HeroSkin, OtherImage, SkinButton, SkinKillNotification
from app.repositories.storage_repository import StorageRepository

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = BACKEND_ROOT / "seed_assets"
MANIFEST_PATH = BACKEND_ROOT / "app" / "db" / "seed_catalog.json"


def _ext(relative_asset_path: str) -> str:
    ext = os.path.splitext(relative_asset_path)[1]
    return ext if ext else ".png"


def _read_asset(relative_path: str) -> bytes | None:
    full_path = ASSETS_DIR / relative_path
    if not full_path.exists():
        print(f"[seed_catalog] missing asset file, skipping: {relative_path}", flush=True)
        return None
    return full_path.read_bytes()


def seed_catalog_from_bundle() -> None:
    if not MANIFEST_PATH.exists():
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    db = SessionLocal()
    storage = StorageRepository()
    counts = {"hero_skins": 0, "skin_buttons": 0, "skin_kill_notifications": 0, "other_images": 0, "counted_images": 0}

    try:
        heroes_by_code = {h.code: h for h in db.query(Hero).all()}

        # ── Hero skins ────────────────────────────────
        for entry in manifest.get("hero_skins", []):
            hero = heroes_by_code.get(entry["hero_code"])
            if not hero:
                continue
            existing = (
                db.query(HeroSkin)
                .filter(HeroSkin.hero_id == hero.id, HeroSkin.skin_code == entry["skin_code"])
                .first()
            )
            if existing:
                continue
            content = _read_asset(entry["asset"])
            if content is None:
                continue
            object_name = f"skins/{hero.code}/{entry['skin_code']}-{uuid.uuid4()}{_ext(entry['asset'])}"
            storage.save_bytes_to_path(content=content, object_name=object_name, content_type="image/png")
            db.add(HeroSkin(
                hero_id=hero.id,
                name=entry["name"],
                skin_code=entry["skin_code"],
                image_object_name=object_name,
                status=entry.get("status", "ACTIVE"),
                sort_order=entry.get("sort_order", 0),
            ))
            counts["hero_skins"] += 1
        if counts["hero_skins"]:
            db.commit()

        skins_by_key = {
            (s.hero_id, s.skin_code): s
            for s in db.query(HeroSkin).all()
        }

        def _find_skin(hero_code, skin_code):
            hero = heroes_by_code.get(hero_code)
            if not hero:
                return None
            return skins_by_key.get((hero.id, skin_code))

        # ── Skin buttons ───────────────────────────────
        for entry in manifest.get("skin_buttons", []):
            skin = _find_skin(entry["hero_code"], entry["skin_code"])
            if not skin:
                continue
            existing = (
                db.query(SkinButton)
                .filter(SkinButton.skin_id == skin.id, SkinButton.code == entry["code"])
                .first()
            )
            if existing:
                continue
            content = _read_asset(entry["asset"])
            if content is None:
                continue
            object_name = (
                f"skin-buttons/{entry['hero_code']}/{entry['skin_code']}/"
                f"{entry['code']}-{uuid.uuid4()}{_ext(entry['asset'])}"
            )
            storage.save_bytes_to_path(content=content, object_name=object_name, content_type="image/png")
            db.add(SkinButton(
                skin_id=skin.id,
                name=entry["name"],
                code=entry["code"],
                image_object_name=object_name,
                status=entry.get("status", "ACTIVE"),
                sort_order=entry.get("sort_order", 0),
            ))
            counts["skin_buttons"] += 1
        if counts["skin_buttons"]:
            db.commit()

        # ── Skin kill notifications ────────────────────
        for entry in manifest.get("skin_kill_notifications", []):
            skin = _find_skin(entry["hero_code"], entry["skin_code"])
            if not skin:
                continue
            existing = (
                db.query(SkinKillNotification)
                .filter(SkinKillNotification.skin_id == skin.id, SkinKillNotification.code == entry["code"])
                .first()
            )
            if existing:
                continue
            content = _read_asset(entry["asset"])
            if content is None:
                continue
            object_name = (
                f"skin-kill-notifications/{entry['hero_code']}/{entry['skin_code']}/"
                f"{entry['code']}-{uuid.uuid4()}{_ext(entry['asset'])}"
            )
            storage.save_bytes_to_path(content=content, object_name=object_name, content_type="image/png")
            db.add(SkinKillNotification(
                skin_id=skin.id,
                name=entry["name"],
                code=entry["code"],
                image_object_name=object_name,
                status=entry.get("status", "ACTIVE"),
                sort_order=entry.get("sort_order", 0),
            ))
            counts["skin_kill_notifications"] += 1
        if counts["skin_kill_notifications"]:
            db.commit()

        # ── Other images ────────────────────────────────
        existing_other_codes = {c for (c,) in db.query(OtherImage.code).all()}
        for entry in manifest.get("other_images", []):
            if entry["code"] in existing_other_codes:
                continue
            content = _read_asset(entry["asset"])
            if content is None:
                continue
            object_name = f"other-images/{entry['code']}-{uuid.uuid4().hex[:8]}{_ext(entry['asset'])}"
            storage.save_bytes_to_path(content=content, object_name=object_name, content_type="image/png")
            db.add(OtherImage(
                name=entry["name"],
                code=entry["code"],
                image_object_name=object_name,
                status=entry.get("status", "ACTIVE"),
                sort_order=entry.get("sort_order", 0),
            ))
            existing_other_codes.add(entry["code"])
            counts["other_images"] += 1
        if counts["other_images"]:
            db.commit()

        # ── Counted images ──────────────────────────────
        existing_counted_codes = {c for (c,) in db.query(CountedImage.code).all()}
        for entry in manifest.get("counted_images", []):
            if entry["code"] in existing_counted_codes:
                continue
            content = _read_asset(entry["asset"])
            if content is None:
                continue
            object_name = f"counted-images/{entry['code']}-{uuid.uuid4().hex[:8]}{_ext(entry['asset'])}"
            storage.save_bytes_to_path(content=content, object_name=object_name, content_type="image/png")
            db.add(CountedImage(
                name=entry["name"],
                code=entry["code"],
                image_object_name=object_name,
                default_quantity=entry.get("default_quantity", 0),
                status=entry.get("status", "ACTIVE"),
                sort_order=entry.get("sort_order", 0),
            ))
            existing_counted_codes.add(entry["code"])
            counts["counted_images"] += 1
        if counts["counted_images"]:
            db.commit()

        total = sum(counts.values())
        if total:
            print(f"[seed_catalog] restored: {counts}", flush=True)
    except Exception as e:
        print(f"[seed_catalog] error: {e}", flush=True)
    finally:
        db.close()
