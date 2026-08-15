/**
 * Port of backend/app/utils/slug.py — must stay behavior-identical (including
 * the fact that Vietnamese "đ" has no NFD decomposition and is dropped, not
 * converted to "d") so codes generated here match ones already created in the
 * web app for the same names.
 */
export function toSlug(text: string): string {
  // Decompose to NFD, then strip combining diacritical marks (U+0300-U+036F)
  // by code point instead of a regex literal, to avoid embedding raw
  // combining characters in source.
  const decomposed = text.normalize('NFD');
  let s = '';
  for (const ch of decomposed) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    s += ch;
  }

  s = s.toLowerCase();
  s = s.replace(/[^a-z0-9\s-]/g, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s;
}
