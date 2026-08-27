import {
  countedImageRepo,
  getDb,
  heroRepo,
  heroSkinRepo,
  otherImageRepo,
  skinButtonRepo,
  skinKillNotificationRepo,
} from './db';
import { Status } from './types';
import { ImagePrefix, clearPrefix, saveBase64 } from '../storage/fileStorage';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seedCatalogJson = require('../data/seedCatalog.json');

/**
 * Bump this whenever src/data/seedCatalog.json + seedAssetsBase64.json are
 * regenerated from a new web-app export. On launch, a stored version that
 * doesn't match wipes the previously seeded catalog (rows + image files)
 * before re-seeding, so the device ends up with exactly the new bundle
 * rather than the old data with the new data merged on top of it.
 */
const SEED_VERSION = '2026-08-26-catalog-127-heroes-668-skins';
const SEED_VERSION_KEY = 'seed_version';

// Lazily required (not a top-level import) so the ~28MB base64 blob is only
// ever loaded into memory when there's actually unseeded data to import —
// on every launch after the first, seeding is a no-op and this never runs.
function loadSeedAssetsBase64(): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../data/seedAssetsBase64.json');
}

interface HeroEntry {
  name: string;
  code: string;
  status: Status;
}
interface HeroSkinEntry {
  hero_code: string;
  name: string;
  skin_code: string;
  status: Status;
  sort_order: number;
  asset: string;
}
interface SkinScopedEntry {
  hero_code: string;
  skin_code: string;
  name: string;
  code: string;
  status: Status;
  sort_order: number;
  asset: string;
}
interface StandaloneEntry {
  name: string;
  code: string;
  status: Status;
  sort_order: number;
  asset: string;
  default_quantity?: number;
}
interface SeedCatalog {
  heroes?: HeroEntry[];
  hero_skins: HeroSkinEntry[];
  skin_buttons: SkinScopedEntry[];
  skin_kill_notifications: SkinScopedEntry[];
  other_images: StandaloneEntry[];
  counted_images: StandaloneEntry[];
}

const catalog = seedCatalogJson as SeedCatalog;

function extOf(relativePath: string): string {
  const dot = relativePath.lastIndexOf('.');
  return dot >= 0 ? relativePath.slice(dot + 1) : 'png';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Writes a bundled seed image (embedded as a base64 string, see
 * src/data/seedAssetsBase64.json) into local storage.
 *
 * Deliberately NOT using require()'d image files at all. On Android release
 * builds, React Native compiles require()'d images into native drawable
 * resources rather than flat files, and there is no reliable way to read
 * them back as raw bytes at runtime — confirmed broken via two different
 * approaches: expo-asset's Asset.fromModule().downloadAsync().localUri
 * comes back as a bare resource name with no URI scheme ("URI is not
 * absolute"), and Image.resolveAssetSource().uri + fetch() gets the same
 * bare resource name and fetch can't build a URL from it either
 * ("MalformedURLException: no protocol"). Embedding the images as base64
 * strings sidesteps the asset-resolution system entirely — they're just JS
 * string data — and expo-file-system's File.write(base64, { encoding:
 * 'base64' }) decodes and writes them directly.
 */
async function importSeedImageOnce(relativeAssetPath: string, prefix: ImagePrefix): Promise<string | null> {
  const base64 = loadSeedAssetsBase64()[relativeAssetPath];
  if (base64 === undefined) return null;
  return saveBase64(base64, prefix, extOf(relativeAssetPath));
}

/** Retries a couple of times in case of a transient native-bridge hiccup
 * under sustained rapid-fire calls (172 sequential asset reads on startup),
 * before giving up and letting the caller record it as a real failure. */
async function importSeedImage(relativeAssetPath: string, prefix: ImagePrefix): Promise<string | null> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await importSeedImageOnce(relativeAssetPath, prefix);
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(150 * attempt);
    }
  }
  throw lastErr;
}

async function seedHeroes(): Promise<void> {
  const existing = await heroRepo.list();
  const existingCodes = new Set(existing.map((h) => h.code));
  // Hero list comes from the exported manifest so it stays in lockstep with
  // the skins that reference it by hero_code.
  for (const entry of catalog.heroes ?? []) {
    if (existingCodes.has(entry.code)) continue;
    await heroRepo.create({ name: entry.name, code: entry.code, status: entry.status });
    existingCodes.add(entry.code);
  }
}

/** Image prefixes owned by the seeded catalog — wiped together with its rows
 * when a stale bundle is replaced. User working files (backgrounds,
 * crop-sources, win-rate, extras) are deliberately left alone. */
const SEEDED_PREFIXES: ImagePrefix[] = [
  'skins',
  'buttons',
  'kill-notifications',
  'other-images',
  'counted-images',
];

async function getStoredSeedVersion(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [SEED_VERSION_KEY]
  );
  return row?.value ?? null;
}

async function setStoredSeedVersion(version: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [SEED_VERSION_KEY, version]
  );
}

/** Drops every catalog row and its image files so the new bundle can be
 * seeded into a clean slate. hero_skins/buttons/kill-notifications cascade
 * from heroes, but they're deleted explicitly so this doesn't silently
 * depend on PRAGMA foreign_keys being on. */
async function wipeSeededCatalog(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM skin_buttons;
    DELETE FROM skin_kill_notifications;
    DELETE FROM hero_skins;
    DELETE FROM heroes;
    DELETE FROM other_images;
    DELETE FROM counted_images;
  `);
  for (const prefix of SEEDED_PREFIXES) {
    try {
      clearPrefix(prefix);
    } catch {
      // A prefix that can't be removed just leaves orphaned files behind —
      // not worth failing the whole reseed over.
    }
  }
}

export interface SeedProgress {
  stage: string;
  done: number;
  total: number;
}

export interface SeedFailure {
  stage: string;
  key: string;
  error: string;
}

/**
 * Idempotently restores the catalog snapshot bundled with the app (see
 * mobile/scripts/generateSeedAssets.js + src/data/seedCatalog.json). Only
 * inserts rows missing by natural key, so it's safe on every launch and
 * never touches anything the user has added since.
 *
 * Every item is seeded independently inside its own try/catch — one bad
 * asset must never block the other ~170 from loading. Failures are
 * collected and returned (not thrown) so the caller can decide whether to
 * surface them.
 */
export async function seedCatalogIfNeeded(onProgress?: (p: SeedProgress) => void): Promise<SeedFailure[]> {
  const failures: SeedFailure[] = [];

  // A bundled catalog newer than what's on the device replaces it outright.
  // Insert-only seeding can add new entries but can never remove or update
  // ones that changed, so merging a new export onto old data would leave
  // stale skins behind forever.
  try {
    const storedVersion = await getStoredSeedVersion();
    if (storedVersion !== SEED_VERSION) {
      onProgress?.({ stage: 'Đang xoá dữ liệu cũ', done: 0, total: 1 });
      await wipeSeededCatalog();
      await setStoredSeedVersion(SEED_VERSION);
    }
  } catch (err) {
    failures.push({ stage: 'reset', key: 'wipe', error: String(err) });
  }

  try {
    await seedHeroes();
  } catch (err) {
    failures.push({ stage: 'heroes', key: 'heroes', error: String(err) });
  }

  const db = await getDb();
  const heroes = await heroRepo.list();
  const heroesByCode = new Map(heroes.map((h) => [h.code, h]));

  const total =
    catalog.hero_skins.length +
    catalog.skin_buttons.length +
    catalog.skin_kill_notifications.length +
    catalog.other_images.length +
    catalog.counted_images.length;
  let done = 0;
  const tick = (stage: string) => {
    done += 1;
    onProgress?.({ stage, done, total });
  };

  // ── Hero skins ──────────────────────────────────
  const existingSkinRows = await db.getAllAsync<{ hero_id: string; skin_code: string }>(
    'SELECT hero_id, skin_code FROM hero_skins'
  );
  const existingSkinKeys = new Set(existingSkinRows.map((r) => `${r.hero_id}::${r.skin_code}`));

  for (const entry of catalog.hero_skins) {
    try {
      const hero = heroesByCode.get(entry.hero_code);
      if (hero && !existingSkinKeys.has(`${hero.id}::${entry.skin_code}`)) {
        const imagePath = await importSeedImage(entry.asset, 'skins');
        if (imagePath) {
          await heroSkinRepo.create(hero.id, {
            name: entry.name,
            code: entry.skin_code,
            image_path: imagePath,
            status: entry.status,
            sort_order: entry.sort_order,
          });
          existingSkinKeys.add(`${hero.id}::${entry.skin_code}`);
        }
      }
    } catch (err) {
      failures.push({ stage: 'hero_skins', key: `${entry.hero_code}/${entry.skin_code}`, error: String(err) });
    }
    tick('hero_skins');
  }

  // ── Skin buttons / kill notifications (need fresh skin ids) ─
  const skinRows = await db.getAllAsync<{ id: string; hero_id: string; skin_code: string }>(
    'SELECT id, hero_id, skin_code FROM hero_skins'
  );
  const skinIdByKey = new Map(skinRows.map((r) => [`${r.hero_id}::${r.skin_code}`, r.id]));

  const existingButtonRows = await db.getAllAsync<{ skin_id: string; code: string }>(
    'SELECT skin_id, code FROM skin_buttons'
  );
  const existingButtonKeys = new Set(existingButtonRows.map((r) => `${r.skin_id}::${r.code}`));

  for (const entry of catalog.skin_buttons) {
    try {
      const hero = heroesByCode.get(entry.hero_code);
      const skinId = hero ? skinIdByKey.get(`${hero.id}::${entry.skin_code}`) : undefined;
      if (skinId && !existingButtonKeys.has(`${skinId}::${entry.code}`)) {
        const imagePath = await importSeedImage(entry.asset, 'buttons');
        if (imagePath) {
          await skinButtonRepo.create(skinId, {
            name: entry.name,
            code: entry.code,
            image_path: imagePath,
            status: entry.status,
            sort_order: entry.sort_order,
          });
          existingButtonKeys.add(`${skinId}::${entry.code}`);
        }
      }
    } catch (err) {
      failures.push({ stage: 'skin_buttons', key: `${entry.hero_code}/${entry.skin_code}/${entry.code}`, error: String(err) });
    }
    tick('skin_buttons');
  }

  const existingNotifRows = await db.getAllAsync<{ skin_id: string; code: string }>(
    'SELECT skin_id, code FROM skin_kill_notifications'
  );
  const existingNotifKeys = new Set(existingNotifRows.map((r) => `${r.skin_id}::${r.code}`));

  for (const entry of catalog.skin_kill_notifications) {
    try {
      const hero = heroesByCode.get(entry.hero_code);
      const skinId = hero ? skinIdByKey.get(`${hero.id}::${entry.skin_code}`) : undefined;
      if (skinId && !existingNotifKeys.has(`${skinId}::${entry.code}`)) {
        const imagePath = await importSeedImage(entry.asset, 'kill-notifications');
        if (imagePath) {
          await skinKillNotificationRepo.create(skinId, {
            name: entry.name,
            code: entry.code,
            image_path: imagePath,
            status: entry.status,
            sort_order: entry.sort_order,
          });
          existingNotifKeys.add(`${skinId}::${entry.code}`);
        }
      }
    } catch (err) {
      failures.push({ stage: 'skin_kill_notifications', key: `${entry.hero_code}/${entry.skin_code}/${entry.code}`, error: String(err) });
    }
    tick('skin_kill_notifications');
  }

  // ── Other images ────────────────────────────────
  const existingOther = new Set((await otherImageRepo.list()).map((i) => i.code));
  for (const entry of catalog.other_images) {
    try {
      if (!existingOther.has(entry.code)) {
        const imagePath = await importSeedImage(entry.asset, 'other-images');
        if (imagePath) {
          await otherImageRepo.create({
            name: entry.name,
            code: entry.code,
            image_path: imagePath,
            status: entry.status,
            sort_order: entry.sort_order,
          });
          existingOther.add(entry.code);
        }
      }
    } catch (err) {
      failures.push({ stage: 'other_images', key: entry.code, error: String(err) });
    }
    tick('other_images');
  }

  // ── Counted images ──────────────────────────────
  const existingCounted = new Set((await countedImageRepo.list()).map((i) => i.code));
  for (const entry of catalog.counted_images) {
    try {
      if (!existingCounted.has(entry.code)) {
        const imagePath = await importSeedImage(entry.asset, 'counted-images');
        if (imagePath) {
          await countedImageRepo.create({
            name: entry.name,
            code: entry.code,
            image_path: imagePath,
            default_quantity: entry.default_quantity ?? 0,
            status: entry.status,
            sort_order: entry.sort_order,
          });
          existingCounted.add(entry.code);
        }
      }
    } catch (err) {
      failures.push({ stage: 'counted_images', key: entry.code, error: String(err) });
    }
    tick('counted_images');
  }

  if (failures.length > 0) {
    console.warn(`[seedCatalog] ${failures.length}/${total} items failed to seed:`, failures.slice(0, 5));
  }

  return failures;
}
