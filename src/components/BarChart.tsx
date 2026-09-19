import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export type BarChartPoint = { label: string; value: number };

/**
 * Plain-View bar chart — no charting library or SVG dependency needed, which
 * matters here since neither is installed in this app. Bars are heights in a
 * fixed-height row, scaled against the largest value in the series.
 */
export default function BarChart({ data, height = 90 }: { data: BarChartPoint[]; height?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <View style={styles.row}>
      {data.map((point, index) => {
        const barHeight = Math.max(3, (point.value / maxValue) * height);
        return (
          <View key={`${point.label}-${index}`} style={styles.column}>
            <View style={[styles.track, { height }]}>
              <View style={[styles.bar, { height: barHeight }]} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingTop: spacing.sm,
    },
    column: {
      flex: 1,
      alignItems: 'center',
    },
    track: {
      width: '100%',
      justifyContent: 'flex-end',
    },
    bar: {
      width: '100%',
      borderRadius: radius.sm,
      backgroundColor: colors.greenLight,
      minHeight: 3,
    },
    label: {
      marginTop: 6,
      color: colors.greyDark,
      fontSize: scaleFont(9.5),
      fontWeight: '700',
    },
  });
