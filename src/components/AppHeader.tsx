import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius } from '../theme/layout';
import AnimatedPressable from './AnimatedPressable';
import { scaleFont } from '../theme/typography';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  onBackPress?: () => void;
};

export default function AppHeader({
  title,
  subtitle,
  showBack = true,
  right,
  onBackPress,
}: AppHeaderProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  function handleBack() {
    if (onBackPress) {
      onBackPress();
      return;
    }

    router.back();
  }

  return (
    <View>
      <View style={styles.header}>
        {showBack ? (
          <AnimatedPressable
            pressedScale={0.9}
            style={styles.headerSide}
            onPress={handleBack}
          >
            <View style={styles.backButton}>
              <Ionicons name="chevron-back" size={22} color={colors.white} />
            </View>
          </AnimatedPressable>
        ) : (
          <View style={styles.headerSide} />
        )}

        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>

        <View style={styles.headerSide}>{right}</View>
      </View>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  header: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: scaleFont(20),
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.grey,
    fontSize: scaleFont(13),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
});
