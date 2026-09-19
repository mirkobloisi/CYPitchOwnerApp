import { Platform } from 'react-native';

/**
 * Type sizes in this app were chosen for a phone held about 30cm away. The
 * same pixel sizes on a monitor at arm's length read small — 11px labels in
 * particular — so text is scaled up on web only. Phone and tablet rendering is
 * returned untouched.
 *
 * Small sizes also get a floor, because scaling alone leaves the tiniest
 * labels under the ~12px that is comfortable in a browser.
 */
const WEB_SCALE = 1.15;
const WEB_MIN_FONT_SIZE = 13;

export function scaleFont(size: number) {
  if (Platform.OS !== 'web') return size;

  // Never raise a size by more than 2px purely to hit the floor, so the
  // relative hierarchy between labels and headings is preserved.
  const floor = Math.min(WEB_MIN_FONT_SIZE, size + 2);
  return Math.round(Math.max(size * WEB_SCALE, floor));
}

/** Line heights move with their font size so blocks of text stay balanced. */
export function scaleLine(lineHeight: number) {
  if (Platform.OS !== 'web') return lineHeight;
  return Math.round(lineHeight * WEB_SCALE);
}
