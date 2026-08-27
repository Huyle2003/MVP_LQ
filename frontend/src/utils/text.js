/** Uppercases the first letter of every word, leaving the rest of each word
 * untouched. Works with Vietnamese diacritics since String#toUpperCase()
 * handles precomposed Unicode characters correctly. */
export function capitalizeWords(str) {
  return str.replace(/(^|\s)(\S)/g, (_match, sep, ch) => sep + ch.toUpperCase())
}
