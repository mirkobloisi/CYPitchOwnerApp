import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius } from '../theme/layout';
import { scaleFont } from '../theme/typography';

/** Percent change vs. the previous period, e.g. "+18%" in green or "-6%" in red. */
export default function GrowthPill({ pctChange }: { pctChange: number | null }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (pctChange === null) {
    return (
      <View style={[styles.pill, styles.neutral]}>
        <Text style={[styles.text, { color: colors.grey }]}>—</Text>
      </View>
    );
  }

  const isFlat = Math.abs(pctChange) < 0.5;
  const isUp = pctChange > 0;

  return (
    <View style={[styles.pill, isFlat ? styles.neutral : isUp ? styles.up : styles.down]}>
      <Ionicons
        name={isFlat ? 'remove' : isUp ? 'arrow-up' : 'arrow-down'}
        size={11}
        color={isFlat ? colors.grey : isUp ? colors.greenLight : colors.red}
      />
      <Text style={[styles.text, { color: isFlat ? colors.grey : isUp ? colors.greenLight : colors.red }]}>
        {isFlat ? 'flat' : `${Math.abs(pctChange).toFixed(0)}%`}
      </Text>
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: radius.round,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    up: { backgroundColor: colors.greenSoft, borderColor: colors.borderGreen },
    down: { backgroundColor: colors.redSoft, borderColor: colors.red },
    neutral: { backgroundColor: colors.card, borderColor: colors.border },
    text: {
      fontSize: scaleFont(10.5),
      fontWeight: '800',
    },
  });
