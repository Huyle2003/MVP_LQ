/**
 * SQLite schema — local mirror of backend/app/db/models.py, minus User (no
 * auth on mobile) and minus Hero.avatar_object_name / HeroSkin.preview_object_name
 * (both existed in the original DB but had no working upload UI in the web
 * app, so they aren't worth porting).
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS heroes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_heroes_name ON heroes(name);

CREATE TABLE IF NOT EXISTS hero_skins (
  id TEXT PRIMARY KEY NOT NULL,
  hero_id TEXT NOT NULL REFERENCES heroes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  skin_code TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (hero_id, skin_code)
);
CREATE INDEX IF NOT EXISTS idx_hero_skins_hero_id ON hero_skins(hero_id);

CREATE TABLE IF NOT EXISTS skin_buttons (
  id TEXT PRIMARY KEY NOT NULL,
  skin_id TEXT NOT NULL REFERENCES hero_skins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (skin_id, code)
);
CREATE INDEX IF NOT EXISTS idx_skin_buttons_skin_id ON skin_buttons(skin_id);

CREATE TABLE IF NOT EXISTS skin_kill_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  skin_id TEXT NOT NULL REFERENCES hero_skins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (skin_id, code)
);
CREATE INDEX IF NOT EXISTS idx_skin_kill_notifications_skin_id ON skin_kill_notifications(skin_id);

CREATE TABLE IF NOT EXISTS other_images (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counted_images (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;
