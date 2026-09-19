import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../i18n/LanguageContext';
import { DURATION_OPTIONS, formatDuration } from '../lib/slots';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import AnimatedPressable from './AnimatedPressable';
import { scaleFont } from '../theme/typography';

type DurationPickerProps = {
  value: number;
  onChange: (minutes: number) => void;
  /** When provided, an extra "All day" chip is shown. */
  allDay?: boolean;
  onAllDayChange?: (allDay: boolean) => void;
  /** Extra lengths to offer, e.g. the current length of a booking being edited. */
  extraOptions?: number[];
};

export default function DurationPicker({
  value,
  onChange,
  allDay = false,
  onAllDayChange,
  extraOptions,
}: DurationPickerProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const options = useMemo(() => {
    const merged = new Set<number>(DURATION_OPTIONS);
    (extraOptions ?? []).forEach((minutes) => {
      if (minutes > 0) merged.add(minutes);
    });
    return Array.from(merged).sort((a, b) => a - b);
  }, [extraOptions]);

  return (
    <View style={styles.row}>
      {options.map((minutes) => {
        const isSelected = !allDay && minutes === value;

        return (
          <AnimatedPressable
            key={minutes}
            pressedScale={0.94}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => {
              onAllDayChange?.(false);
              onChange(minutes);
            }}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {formatDuration(minutes)}
            </Text>
          </AnimatedPressable>
        );
      })}

      {onAllDayChange ? (
        <AnimatedPressable
          pressedScale={0.94}
          style={[styles.chip, allDay && styles.chipSelected]}
          onPress={() => onAllDayChange(!allDay)}
        >
          <Text style={[styles.chipText, allDay && styles.chipTextSelected]}>{t('durationPicker.allDay')}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
      borderRadius: radius.round,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipSelected: {
      backgroundColor: colors.greenSoft,
      borderColor: colors.borderGreen,
    },
    chipText: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    chipTextSelected: {
      color: colors.greenLight,
    },
  });
