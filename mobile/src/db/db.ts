import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

import { SCHEMA_SQL } from './schema';
import { ListFilter, Status } from './types';
import { toSlug } from '../utils/slug';

const DB_NAME = 'skin_composer.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })();
  }
  return dbPromise;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return Crypto.randomUUID();
}

/** code = explicit value if given, otherwise slugified from name. */
function resolveCode(name: string, explicitCode?: string | null): string {
  const trimmed = explicitCode?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : toSlug(name);
}

/** Turns raw SQLite constraint errors (e.g. "UNIQUE constraint failed:
 * hero_skins.hero_id, hero_skins.skin_code", wrapped in a native
 * "NativeStatement.finalizeAsync has been rejected" message) into a plain
 * Vietnamese message the catalogue/crop forms can show directly. */
function translateDbError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('UNIQUE constraint failed')) {
    if (msg.includes('hero_skins.')) {
      return new Error('Tên hoặc mã skin này đã tồn tại cho tướng đã chọn. Vui lòng đổi tên hoặc nhập mã skin khác.');
    }
    if (msg.includes('skin_buttons.')) {
      return new Error('Tên hoặc mã nút bấm này đã tồn tại cho skin đã chọn. Vui lòng đổi tên hoặc nhập mã khác.');
    }
    if (msg.includes('skin_kill_notifications.')) {
      return new Error('Tên hoặc mã thông báo hạ này đã tồn tại cho skin đã chọn. Vui lòng đổi tên hoặc nhập mã khác.');
    }
    if (msg.includes('heroes.name')) {
      return new Error('Tên tướng này đã tồn tại. Vui lòng đổi tên khác.');
    }
    if (msg.includes('heroes.code')) {
      return new Error('Mã tướng này đã tồn tại. Vui lòng đổi tên hoặc nhập mã khác.');
    }
    if (msg.includes('other_images.code')) {
      return new Error('Tên hoặc mã ảnh này đã tồn tại. Vui lòng đổi tên hoặc nhập mã khác.');
    }
    if (msg.includes('counted_images.code')) {
      return new Error('Tên hoặc mã ảnh số lượng này đã tồn tại. Vui lòng đổi tên hoặc nhập mã khác.');
    }
    return new Error('Tên hoặc mã này đã tồn tại, vui lòng đổi giá trị khác.');
  }
  return err instanceof Error ? err : new Error(String(err));
}

/** INSERT/UPDATE wrapper — DELETE and SELECT calls can't hit a UNIQUE
 * constraint so they keep using db.runAsync/getAllAsync directly. */
async function runWriteAsync(
  db: SQLite.SQLiteDatabase,
  sql: string,
  params: (string | number)[]
): Promise<void> {
  try {
    await db.runAsync(sql, params);
  } catch (err) {
    throw translateDbError(err);
  }
}

async function listWhere<T>(
  db: SQLite.SQLiteDatabase,
  table: string,
  clauses: string[],
  params: (string | number)[],
  columns = '*',
  orderBy = 'sort_order ASC, created_at ASC'
): Promise<T[]> {
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.getAllAsync<T>(
    `SELECT ${columns} FROM ${table} ${where} ORDER BY ${orderBy}`,
    params
  );
}

/** hero_skins keeps its DB column named skin_code (parity with the backend's
 * `uq_hero_skin_code` constraint) but is exposed to the app as `code`, same
 * as every other catalogue table, so the generic CatalogueScreen UI doesn't
 * need a special case. */
const HERO_SKIN_COLUMNS =
  'id, hero_id, name, skin_code AS code, image_path, status, sort_order, created_at, updated_at';

function filterClauses(filter?: ListFilter): { clauses: string[]; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter?.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.keyword) {
    clauses.push('name LIKE ?');
    params.push(`%${filter.keyword}%`);
  }
  return { clauses, params };
}

// ─── Heroes ──────────────────────────────────────────────
export interface HeroInput {
  name: string;
  code?: string;
  status?: Status;
}

export const heroRepo = {
  async list(filter?: ListFilter) {
    const db = await getDb();
    const { clauses, params } = filterClauses(filter);
    return listWhere<import('./types').Hero>(db, 'heroes', clauses, params, '*', 'name ASC');
  },
  async get(id: string) {
    const db = await getDb();
    return db.getFirstAsync<import('./types').Hero>('SELECT * FROM heroes WHERE id = ?', [id]);
  },
  async create(input: HeroInput) {
    const db = await getDb();
    const id = newId();
    const ts = nowIso();
    const code = resolveCode(input.name, input.code);
    await runWriteAsync(
      db,
      `INSERT INTO heroes (id, name, code, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name.trim(), code, input.status ?? 'ACTIVE', ts, ts]
    );
    return id;
  },
  async update(id: string, patch: Partial<HeroInput>) {
    const db = await getDb();
    const current = await heroRepo.get(id);
    if (!current) throw new Error('Không tìm thấy tướng');
    const name = patch.name?.trim() ?? current.name;
    const code = patch.code !== undefined ? resolveCode(name, patch.code) : current.code;
    const status = patch.status ?? current.status;
    await runWriteAsync(
      db,
      `UPDATE heroes SET name = ?, code = ?, status = ?, updated_at = ? WHERE id = ?`,
      [name, code, status, nowIso(), id]
    );
  },
  async remove(id: string) {
    const db = await getDb();
    await db.runAsync('DELETE FROM heroes WHERE id = ?', [id]);
  },
};

// ─── Hero Skins ──────────────────────────────────────────
export interface HeroSkinInput {
  name: string;
  code?: string;
  image_path: string;
  status?: Status;
  sort_order?: number;
}

export const heroSkinRepo = {
  async list(heroId: string, filter?: ListFilter) {
    const db = await getDb();
    const { clauses, params } = filterClauses(filter);
    clauses.unshift('hero_id = ?');
    params.unshift(heroId);
    return listWhere<import('./types').HeroSkin>(db, 'hero_skins', clauses, params, HERO_SKIN_COLUMNS);
  },
  async get(id: string) {
    const db = await getDb();
    return db.getFirstAsync<import('./types').HeroSkin>(
      `SELECT ${HERO_SKIN_COLUMNS} FROM hero_skins WHERE id = ?`,
      [id]
    );
  },
  async create(heroId: string, input: HeroSkinInput) {
    const db = await getDb();
    const id = newId();
    const ts = nowIso();
    const skinCode = resolveCode(input.name, input.code);
    await runWriteAsync(
      db,
      `INSERT INTO hero_skins (id, hero_id, name, skin_code, image_path, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, heroId, input.name.trim(), skinCode, input.image_path, input.status ?? 'ACTIVE', input.sort_order ?? 0, ts, ts]
    );
    return id;
  },
  async update(id: string, patch: Partial<HeroSkinInput>) {
    const db = await getDb();
    const current = await heroSkinRepo.get(id);
    if (!current) throw new Error('Không tìm thấy skin');
    const name = patch.name?.trim() ?? current.name;
    const skinCode = patch.code !== undefined ? resolveCode(name, patch.code) : current.code;
    await runWriteAsync(
      db,
      `UPDATE hero_skins SET name = ?, skin_code = ?, image_path = ?, status = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [
        name,
        skinCode,
        patch.image_path ?? current.image_path,
        patch.status ?? current.status,
        patch.sort_order ?? current.sort_order,
        nowIso(),
        id,
      ]
    );
  },
  async remove(id: string) {
    const db = await getDb();
    await db.runAsync('DELETE FROM hero_skins WHERE id = ?', [id]);
  },
};

// ─── Skin-scoped catalogues (buttons, kill notifications) ─
export interface SkinScopedInput {
  name: string;
  code?: string;
  image_path: string;
  status?: Status;
  sort_order?: number;
}

function createSkinScopedRepo(table: 'skin_buttons' | 'skin_kill_notifications') {
  return {
    async list(skinId: string, filter?: ListFilter) {
      const db = await getDb();
      const { clauses, params } = filterClauses(filter);
      clauses.unshift('skin_id = ?');
      params.unshift(skinId);
      return listWhere<import('./types').SkinButton | import('./types').SkinKillNotification>(
        db,
        table,
        clauses,
        params
      );
    },
    async get(id: string) {
      const db = await getDb();
      return db.getFirstAsync<import('./types').SkinButton>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },
    async create(skinId: string, input: SkinScopedInput) {
      const db = await getDb();
      const id = newId();
      const ts = nowIso();
      const code = resolveCode(input.name, input.code);
      await runWriteAsync(
        db,
        `INSERT INTO ${table} (id, skin_id, name, code, image_path, status, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, skinId, input.name.trim(), code, input.image_path, input.status ?? 'ACTIVE', input.sort_order ?? 0, ts, ts]
      );
      return id;
    },
    async update(id: string, patch: Partial<SkinScopedInput>) {
      const db = await getDb();
      const current = await db.getFirstAsync<import('./types').SkinButton>(
        `SELECT * FROM ${table} WHERE id = ?`,
        [id]
      );
      if (!current) throw new Error('Không tìm thấy mục');
      const name = patch.name?.trim() ?? current.name;
      const code = patch.code !== undefined ? resolveCode(name, patch.code) : current.code;
      await runWriteAsync(
        db,
        `UPDATE ${table} SET name = ?, code = ?, image_path = ?, status = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
        [
          name,
          code,
          patch.image_path ?? current.image_path,
          patch.status ?? current.status,
          patch.sort_order ?? current.sort_order,
          nowIso(),
          id,
        ]
      );
    },
    async remove(id: string) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },
  };
}

export const skinButtonRepo = createSkinScopedRepo('skin_buttons');
export const skinKillNotificationRepo = createSkinScopedRepo('skin_kill_notifications');

// ─── Standalone catalogues (other images, counted images) ─
export interface StandaloneCatalogueInput {
  name: string;
  code?: string;
  image_path?: string;
  status?: Status;
  sort_order?: number;
  default_quantity?: number;
}

function createStandaloneCatalogueRepo<
  T extends {
    id: string;
    name: string;
    code: string;
    image_path: string;
    status: Status;
    sort_order: number;
    default_quantity?: number;
  }
>(
  table: 'other_images' | 'counted_images',
  hasDefaultQuantity: boolean
) {
  const columns = hasDefaultQuantity
    ? 'id, name, code, image_path, default_quantity, status, sort_order, created_at, updated_at'
    : 'id, name, code, image_path, status, sort_order, created_at, updated_at';
  const placeholders = columns
    .split(', ')
    .map(() => '?')
    .join(', ');

  return {
    async list(filter?: ListFilter) {
      const db = await getDb();
      const { clauses, params } = filterClauses(filter);
      return listWhere<T>(db, table, clauses, params);
    },
    async get(id: string) {
      const db = await getDb();
      return db.getFirstAsync<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },
    async create(input: StandaloneCatalogueInput) {
      if (!input.image_path) throw new Error('Thiếu ảnh');
      const db = await getDb();
      const id = newId();
      const ts = nowIso();
      const code = resolveCode(input.name, input.code);
      const values: (string | number)[] = hasDefaultQuantity
        ? [
            id,
            input.name.trim(),
            code,
            input.image_path,
            input.default_quantity ?? 0,
            input.status ?? 'ACTIVE',
            input.sort_order ?? 0,
            ts,
            ts,
          ]
        : [id, input.name.trim(), code, input.image_path, input.status ?? 'ACTIVE', input.sort_order ?? 0, ts, ts];
      await runWriteAsync(db, `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, values);
      return id;
    },
    async update(id: string, patch: Partial<StandaloneCatalogueInput>) {
      const db = await getDb();
      const current = await db.getFirstAsync<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      if (!current) throw new Error('Không tìm thấy mục');
      const name = patch.name?.trim() ?? current.name;
      const code = patch.code !== undefined ? resolveCode(name, patch.code) : current.code;
      const setSql = hasDefaultQuantity
        ? 'name = ?, code = ?, image_path = ?, default_quantity = ?, status = ?, sort_order = ?, updated_at = ?'
        : 'name = ?, code = ?, image_path = ?, status = ?, sort_order = ?, updated_at = ?';
      const values: (string | number)[] = hasDefaultQuantity
        ? [
            name,
            code,
            patch.image_path ?? current.image_path,
            patch.default_quantity ?? current.default_quantity ?? 0,
            patch.status ?? current.status,
            patch.sort_order ?? current.sort_order,
            nowIso(),
          ]
        : [
            name,
            code,
            patch.image_path ?? current.image_path,
            patch.status ?? current.status,
            patch.sort_order ?? current.sort_order,
            nowIso(),
          ];
      values.push(id);
      await runWriteAsync(db, `UPDATE ${table} SET ${setSql} WHERE id = ?`, values);
    },
    async remove(id: string) {
      const db = await getDb();
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },
  };
}

export const otherImageRepo = createStandaloneCatalogueRepo<import('./types').OtherImage>('other_images', false);
export const countedImageRepo = createStandaloneCatalogueRepo<import('./types').CountedImage>(
  'counted_images',
  true
);
