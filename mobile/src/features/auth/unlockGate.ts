import { File, Paths } from 'expo-file-system';

/**
 * A soft one-time gate, not real security — the app is fully offline with
 * no server to check against, so this string necessarily ships in plain
 * text inside the app bundle. It only keeps out casual/accidental access,
 * not anyone willing to inspect the app package.
 */
const REQUIRED_PASSWORD = 'FB: Lê Đăng Huy bản tool ghép ảnh free';

const UNLOCK_MARKER_NAME = '.app_unlocked';

function unlockMarkerFile(): File {
  return new File(Paths.document, UNLOCK_MARKER_NAME);
}

/** True once the correct password has ever been entered on this device. */
export function isUnlocked(): boolean {
  return unlockMarkerFile().exists;
}

export function checkPassword(input: string): boolean {
  return input.trim() === REQUIRED_PASSWORD;
}

export function markUnlocked(): void {
  const file = unlockMarkerFile();
  if (!file.exists) {
    file.write('1');
  }
}
