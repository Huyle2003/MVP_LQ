/**
 * Regenerates src/data/seedAssetsBase64.json from assets/seed-catalog/.
 *
 * Why base64-in-JSON instead of require()'d image files: on Android release
 * builds, React Native compiles require()'d images into native drawable
 * resources, not flat files — there is no reliable way to read them back as
 * raw bytes at runtime (confirmed broken via multiple approaches: expo-asset's
 * Asset.downloadAsync().localUri comes back as a bare resource name with no
 * scheme; Image.resolveAssetSource().uri + fetch() gets the same bare
 * resource name and fetch can't build a URL from it). Encoding the images as
 * base64 strings makes them plain JS string data instead of "assets" in
 * Metro's asset-resolution sense, so none of that machinery is involved —
 * expo-file-system's File.write(base64, { encoding: 'base64' }) decodes and
 * writes them directly.
 *
 * Reads straight from backend/seed_assets/ (what
 * backend/scripts/export_seed_bundle.py writes) rather than keeping a second
 * copy of every image under mobile/ — the base64 JSON is the only form the
 * app actually ships, so a duplicate image folder would just add tens of MB
 * to the repo and to every EAS build upload for nothing.
 *
 * Usage:
 *   1. docker exec image_mvp_api python scripts/export_seed_bundle.py
 *   2. cp backend/app/db/seed_catalog.json mobile/src/data/seedCatalog.json
 *   3. node scripts/generateSeedAssetsBase64.js
 *   4. bump SEED_VERSION in src/db/seedCatalog.ts
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.resolve(ROOT, '..', 'backend', 'seed_assets');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'seedAssetsBase64.json');

function walk(dir, baseDir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, baseDir, out);
    } else {
      const rel = path.relative(baseDir, full).split(path.sep).join('/');
      out.push(rel);
    }
  }
}

const files = [];
walk(ASSETS_DIR, ASSETS_DIR, files);
files.sort();

const map = {};
for (const rel of files) {
  const full = path.join(ASSETS_DIR, rel);
  map[rel] = fs.readFileSync(full).toString('base64');
}

fs.writeFileSync(OUT_FILE, JSON.stringify(map), 'utf-8');
const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
console.log(`Wrote ${OUT_FILE} with ${files.length} entries (${sizeMb} MB)`);
