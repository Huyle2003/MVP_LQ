export type Status = 'ACTIVE' | 'INACTIVE';

export interface ListFilter {
  keyword?: string;
  status?: Status;
}

/** Fields shared by the "catalogue item" tables (not Hero, which has no
 * sort_order or image in the original backend model). */
interface CatalogueRow {
  id: string;
  name: string;
  code: string;
  image_path: string;
  status: Status;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Hero {
  id: string;
  name: string;
  code: string;
  status: Status;
  created_at: string;
  updated_at: string;
}

/**
 * `code` here is an app-level alias for the `skin_code` DB column (kept
 * distinctly named in schema.ts to mirror backend/app/db/models.py's
 * `uq_hero_skin_code` constraint) — aliased in SELECTs so the generic
 * catalogue UI can treat every entity's identifier field uniformly.
 */
export interface HeroSkin extends CatalogueRow {
  hero_id: string;
}

export interface SkinButton extends CatalogueRow {
  skin_id: string;
}

export interface SkinKillNotification extends CatalogueRow {
  skin_id: string;
}

export interface OtherImage extends CatalogueRow {}

export interface CountedImage extends CatalogueRow {
  default_quantity: number;
}
