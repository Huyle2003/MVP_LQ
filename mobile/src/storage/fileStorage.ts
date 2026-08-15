import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

/**
 * Local replacement for MinIO's object_name prefixes
 * (backend/app/repositories/storage_repository.py). Every image the app
 * owns lives under Paths.document/<prefix>/<uuid>.<ext>; the DB stores the
 * "<prefix>/<uuid>.<ext>" relative path, mirroring the old object_name.
 */
export type ImagePrefix =
  | 'skins'
  | 'buttons'
  | 'kill-notifications'
  | 'other-images'
  | 'counted-images'
  | 'backgrounds'
  | 'crop-sources'
  | 'win-rate'
  | 'extras';

function ensureDir(prefix: ImagePrefix): Directory {
  const dir = new Directory(Paths.document, prefix);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function extensionFromUri(uri: string, fallback = 'jpg'): string {
  const ext = Paths.extname(uri).replace(/^\./, '');
  return ext.length > 0 && ext.length <= 5 ? ext.toLowerCase() : fallback;
}

/** Resolve a relative path (as stored in SQLite) back to an absolute file:// URI. */
export function absoluteUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

/** Copy a picked image (expo-image-picker / expo-document-picker uri) into local storage. */
export async function importImage(sourceUri: string, prefix: ImagePrefix): Promise<string> {
  const dir = ensureDir(prefix);
  const filename = `${Crypto.randomUUID()}.${extensionFromUri(sourceUri)}`;
  const destFile = new File(dir, filename);
  await new File(sourceUri).copy(destFile);
  return `${prefix}/${filename}`;
}

/** Write raw bytes (e.g. a PNG produced by the crop/compose engine) into local storage. */
export function saveBytes(bytes: Uint8Array, prefix: ImagePrefix, ext = 'png'): string {
  const dir = ensureDir(prefix);
  const filename = `${Crypto.randomUUID()}.${ext}`;
  const file = new File(dir, filename);
  file.write(bytes);
  return `${prefix}/${filename}`;
}

/** Delete a previously stored image; safe to call if it's already gone. */
export function deleteImage(relativePath: string): void {
  const file = new File(Paths.document, relativePath);
  if (file.exists) file.delete();
}
