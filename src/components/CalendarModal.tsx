import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from './AnimatedPressable';
import AnimatedSelectable from './AnimatedSelectable';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

type CalendarModalProps = {
  visible: boolean;
  /** YYYY-MM-DD, or empty for no selection. */
  value: string;
  title: string;
  minDate?: Date;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Local YYYY-MM-DD — toISOString() would shift the day for anyone east of UTC. */
function toIsoDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * A month grid in plain React Native views, rather than a native date picker:
 * this app runs on web and on phones, and the community picker has no real
 * web story. One implementation, identical on both.
 */
export default function CalendarModal({
  visible,
  value,
  title,
  minDate,
  onSelect,
  onClose,
}: CalendarModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [visibleMonth, setVisibleMonth] = useState(() =>
    selected && !Number.isNaN(selected.getTime()) ? new Date(selected) : new Date()
  );

  const days = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    // Monday-first: JS getDay() is Sunday-first.
    const leading = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - leading);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const floor = minDate ? startOfDay(minDate) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <AnimatedPressable style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.grey} />
            </AnimatedPressable>
          </View>

          <View style={styles.monthRow}>
            <AnimatedPressable
              style={styles.iconButton}
              onPress={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                )
              }
            >
              <Ionicons name="chevron-back" size={18} color={colors.white} />
            </AnimatedPressable>

            <Text style={styles.monthLabel}>
              {visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>

            <AnimatedPressable
              style={styles.iconButton}
              onPress={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                )
              }
            >
              <Ionicons name="chevron-forward" size={18} color={colors.white} />
            </AnimatedPressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((label, index) => (
              <Text key={`${label}-${index}`} style={styles.weekday}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day) => {
              const iso = toIsoDate(day);
              const inMonth = day.getMonth() === visibleMonth.getMonth();
              const isSelected = iso === value;
              const disabled = floor ? startOfDay(day) < floor : false;

              return (
                <AnimatedSelectable
                  key={iso}
                  active={isSelected}
                  disabled={disabled}
                  style={[styles.day, disabled && styles.dayDisabled]}
                  background={['transparent', colors.green]}
                  borderColor={['transparent', colors.borderGreen]}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !inMonth && styles.dayTextOutside,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                </AnimatedSelectable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '800',
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    monthLabel: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    weekdayRow: {
      flexDirection: 'row',
    },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      color: colors.greyDark,
      fontSize: scaleFont(11),
      fontWeight: '800',
      marginBottom: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    day: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    dayDisabled: {
      opacity: 0.3,
    },
    dayText: {
      color: colors.greySoft,
      fontSize: scaleFont(13),
      fontWeight: '700',
    },
    dayTextOutside: {
      color: colors.greyDark,
    },
    dayTextSelected: {
      color: colors.white,
      fontWeight: '900',
    },
  });
