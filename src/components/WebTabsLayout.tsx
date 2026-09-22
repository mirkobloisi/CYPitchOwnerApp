import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, TabTriggerSlotProps, Tabs } from 'expo-router/ui';
import React, { forwardRef, ReactNode, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTranslation } from '../i18n/LanguageContext';
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

  return (
    <Tabs style={styles.root}>
      <Animated.View
        key={pathname}
        entering={FadeIn.duration(180)}
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
              <NavItem label={t(item.labelKey)} icon={item.icon} isDesktop={isDesktop} />
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
};

const NavItem = forwardRef<View, NavItemProps>(function NavItem(
  { label, icon, isDesktop, isFocused, children, ...pressableProps },
  ref
) {
  const { colors } = useAppTheme();
  const themed = useMemo(() => makeStyles(colors), [colors]);

  const tint = isFocused ? colors.greenLight : colors.greyDark;

  return (
    <Pressable
      ref={ref}
      {...pressableProps}
      style={({ pressed }) => [
        isDesktop ? themed.sidebarItem : themed.bottomItem,
        isDesktop && isFocused && themed.sidebarItemActive,
        pressed && themed.itemPressed,
      ]}
    >
      <Ionicons name={icon} size={isDesktop ? 18 : 20} color={tint} />
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
