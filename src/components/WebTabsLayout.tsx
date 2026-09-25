import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import React, { forwardRef, ReactNode, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { useTranslation } from '../i18n/LanguageContext';
import { useAcademyRealtime } from '../lib/academyRealtime';
import {
  BOTTOM_BAR_HEIGHT,
  SIDEBAR_WIDTH,
  useBreakpoint,
} from '../theme/breakpoints';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

type IconName = keyof typeof Ionicons.glyphMap;

const NAV_ITEMS: { name: string; href: string; labelKey: string; icon: IconName }[] = [
  { name: 'agenda', href: '/agenda', labelKey: 'nav.agenda', icon: 'calendar-outline' },
  { name: 'availability', href: '/availability', labelKey: 'nav.availability', icon: 'time-outline' },
  { name: 'pitches', href: '/pitches', labelKey: 'nav.pitches', icon: 'football-outline' },
  { name: 'academy', href: '/academy', labelKey: 'nav.academy', icon: 'school-outline' },
  { name: 'stats', href: '/stats', labelKey: 'nav.stats', icon: 'bar-chart-outline' },
  { name: 'transactions', href: '/transactions', labelKey: 'nav.transactions', icon: 'card-outline' },
  { name: 'profile', href: '/profile', labelKey: 'nav.profile', icon: 'person-circle-outline' },
];

/**
 * Browser navigation for the Pitch Owner app. On a monitor it is a left
 * sidebar; in a narrow window it falls back to the same bottom bar the phone
 * app uses. Built on expo-router's headless tab primitives so the layout is
 * ours while routing stays standard.
 *
 * Native keeps using the platform tab navigator — see (tabs)/_layout.tsx.
 */
export default function WebTabsLayout() {
  const { isDesktop } = useBreakpoint();
  const { t } = useTranslation();
  const pathname = usePathname();
  const { unread } = useAcademyRealtime();

  // A bell sits on the tab a notice came from, so the owner is pointed at the
  // thing that changed rather than at an inbox to sift through.
  const waiting: Record<string, number> = {
    academy: unread.players + unread.parents + unread.messages,
  };

  return (
    <Tabs style={styles.root}>
      <Animated.View
        key={pathname}
        // Reanimated switches entering animations off when the OS asks for
        // reduced motion. This one only cross-fades opacity — nothing moves —
        // so it's safe to keep either way.
        entering={FadeIn.duration(240).reduceMotion(ReduceMotion.Never)}
        style={[
          styles.slot,
          isDesktop ? { paddingLeft: SIDEBAR_WIDTH } : { paddingBottom: BOTTOM_BAR_HEIGHT },
        ]}
      >
        <TabSlot style={styles.slot} />
      </Animated.View>

      <TabList asChild>
        <NavBar isDesktop={isDesktop}>
          {NAV_ITEMS.map((item) => (
            <TabTrigger key={item.name} name={item.name} href={item.href} asChild>
              <NavItem
                label={t(item.labelKey)}
                icon={item.icon}
                isDesktop={isDesktop}
                waiting={waiting[item.name] ?? 0}
              />
            </TabTrigger>
          ))}
        </NavBar>
      </TabList>
    </Tabs>
  );
}

function NavBar({ children, isDesktop }: { children?: ReactNode; isDesktop: boolean }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const themed = useMemo(() => makeStyles(colors), [colors]);

  if (!isDesktop) {
    return <View style={[themed.bottomBar]}>{children}</View>;
  }

  return (
    <View style={themed.sidebar}>
      <View style={themed.brandRow}>
        <Image
          source={require('../../assets/images/mypitch-logo.png')}
          style={themed.brandLogo}
          resizeMode="contain"
          accessibilityLabel="MYPitch"
        />
        <Text style={themed.brandRole}>{t('login.subtitle')}</Text>
      </View>

      <View style={themed.navGroup}>{children}</View>
    </View>
  );
}

type NavItemProps = TabTriggerSlotProps & {
  label: string;
  icon: IconName;
  isDesktop: boolean;
  /** How many notices are waiting on this tab; 0 draws no bell. */
  waiting: number;
};

const NavItem = forwardRef<View, NavItemProps>(function NavItem(
  { label, icon, isDesktop, waiting, isFocused, children, ...pressableProps },
  ref
) {
  const { colors } = useAppTheme();
  const themed = useMemo(() => makeStyles(colors), [colors]);

  const tint = isFocused ? colors.greenLight : colors.greyDark;

  return (
    <Pressable
      ref={ref}
      {...pressableProps}
      style={(state) => [
        isDesktop ? themed.sidebarItem : themed.bottomItem,
        isDesktop && isFocused && themed.sidebarItemActive,
        isDesktop &&
          !isFocused &&
          (state as { hovered?: boolean }).hovered &&
          themed.sidebarItemHovered,
        state.pressed && themed.itemPressed,
      ]}
    >
      <View>
        <Ionicons name={icon} size={isDesktop ? 18 : 20} color={tint} />

        {waiting > 0 ? (
          <View style={themed.bell}>
            <Ionicons name="notifications" size={8} color={colors.blackText} />
          </View>
        ) : null}
      </View>
      <Text
        style={[
          isDesktop ? themed.sidebarLabel : themed.bottomLabel,
          { color: tint },
          isFocused && themed.labelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
});

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    // A bell rather than a plain dot: it says what kind of thing is waiting,
    // not merely that something is.
    bell: {
      position: 'absolute',
      right: -6,
      top: -4,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
    },
    sidebar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: SIDEBAR_WIDTH,
      backgroundColor: colors.card,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
    },
    brandRow: {
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.xl,
    },
    brandLogo: {
      width: '100%',
      maxWidth: 182,
      // Matches the exported asset (600 x 177) so it never distorts.
      aspectRatio: 600 / 177,
    },
    brandRole: {
      color: colors.greenLight,
      fontSize: scaleFont(10),
      fontWeight: '800',
      marginTop: 6,
      marginLeft: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    navGroup: {
      gap: 4,
    },
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 11,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    sidebarItemActive: {
      backgroundColor: colors.greenSoft,
      borderColor: colors.borderGreen,
    },
    sidebarItemHovered: {
      backgroundColor: colors.surfaceMuted,
    },
    sidebarLabel: {
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: BOTTOM_BAR_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    bottomItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: spacing.xs,
    },
    bottomLabel: {
      fontSize: scaleFont(11),
      fontWeight: '800',
    },
    labelActive: {
      fontWeight: '900',
    },
    itemPressed: {
      opacity: 0.7,
    },
  });
