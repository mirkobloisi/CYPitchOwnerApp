import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export type StatusBadgeTone =
  | 'green'
  | 'blue'
  | 'neutral'
  | 'orange'
  | 'yellow'
  | 'red';

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
};

export default function StatusBadge({
  label,
  tone = 'neutral',
}: StatusBadgeProps) {
  const { colors } = useAppTheme();
  const { styles, badgeStyles, textStyles } = buildStyles(colors);

  return (
    <View style={[styles.badge, badgeStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{label}</Text>
    </View>
  );
}

function buildStyles(colors: AppColors) {
  const styles = StyleSheet.create({
    badge: {
      borderRadius: radius.round,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
    },
    text: {
      fontSize: scaleFont(11),
      fontWeight: '900',
    },
  });

  const badgeStyles = StyleSheet.create({
    green: {
      backgroundColor: colors.greenSoft,
      borderColor: colors.borderGreen,
    },
    blue: {
      backgroundColor: colors.blueSoft,
      borderColor: colors.borderBlue,
    },
    neutral: {
      backgroundColor: colors.neutralSoft,
      borderColor: colors.border,
    },
    orange: {
      backgroundColor: colors.orangeSoft,
      borderColor: 'rgba(255, 149, 0, 0.35)',
    },
    yellow: {
      backgroundColor: colors.yellowSoft,
      borderColor: 'rgba(255, 212, 59, 0.35)',
    },
    red: {
      backgroundColor: colors.redSoft,
      borderColor: 'rgba(255, 69, 58, 0.35)',
    },
  });

  const textStyles = StyleSheet.create({
    green: {
      color: colors.greenLight,
    },
    blue: {
      color: colors.blueLight,
    },
    neutral: {
      color: colors.white,
    },
    orange: {
      color: colors.orange,
    },
    yellow: {
      color: colors.yellow,
    },
    red: {
      color: colors.red,
    },
  });

  return { styles, badgeStyles, textStyles };
}
