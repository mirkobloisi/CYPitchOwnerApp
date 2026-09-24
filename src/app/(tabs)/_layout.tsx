import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import WebTabsLayout from '../../components/WebTabsLayout';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { scaleFont } from '../../theme/typography';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  // In a browser the app uses a sidebar layout; phones and tablets keep the
  // platform tab bar untouched. Platform.OS never changes at runtime, so this
  // branch can't cause a remount.
  if (Platform.OS === 'web') {
    return <WebTabsLayout />;
  }

  return (
    <Tabs
      initialRouteName="agenda"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenLight,
        tabBarInactiveTintColor: colors.greyDark,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: scaleFont(11),
          fontWeight: '800',
        },
      }}
    >
      <Tabs.Screen
        name="agenda"
        options={{
          title: t('nav.agenda'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="availability"
        options={{
          title: t('nav.availability'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          title: t('nav.pitches'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="academy"
        options={{
          title: t('nav.academy'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t('nav.stats'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('nav.transactions'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
