import { useWindowDimensions } from 'react-native';

/** Width at which the app switches to a desktop layout with a side rail. */
export const DESKTOP_MIN_WIDTH = 1024;
/** Width at which a tablet gets roomier layouts but keeps the bottom bar. */
export const TABLET_MIN_WIDTH = 768;

/** How wide the desktop side navigation is. */
export const SIDEBAR_WIDTH = 236;
/** Height reserved for the bottom bar on narrow screens. */
export const BOTTOM_BAR_HEIGHT = 64;

/** Default reading width for content on a large screen. */
export const CONTENT_MAX_WIDTH = 900;
/** Wider ceiling for screens that benefit from space, such as the Agenda. */
export const WIDE_CONTENT_MAX_WIDTH = 1320;

export function useBreakpoint() {
  const { width } = useWindowDimensions();

  return {
    width,
    isDesktop: width >= DESKTOP_MIN_WIDTH,
    isTablet: width >= TABLET_MIN_WIDTH && width < DESKTOP_MIN_WIDTH,
    /** Anything roomier than a phone. */
    isWide: width >= TABLET_MIN_WIDTH,
  };
}
