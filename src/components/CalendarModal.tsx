import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  /** Latest selectable date — pass today's date for a date of birth. */
  maxDate?: Date;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Height of one row of the year grid, so it can be scrolled to by index. */
const YEAR_ROW_HEIGHT = 46;

/** How far back a picker reaches when no floor is given — enough for any age. */
const DEFAULT_YEARS_BACK = 100;

/** How far ahead a picker reaches when no ceiling is given. */
const DEFAULT_YEARS_AHEAD = 20;

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

const MONTH_NAMES = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'short' })
);

/**
 * A month grid in plain React Native views, rather than a native date picker:
 * this app runs on web and on phones, and the community picker has no real
 * web story. One implementation, identical on both.
 *
 * Tapping the month label opens a year list and then a month grid, so a date
 * of birth is three taps away instead of hundreds of presses on the back
 * chevron.
 */
export default function CalendarModal({
  visible,
  value,
  title,
  minDate,
  maxDate,
  onSelect,
  onClose,
}: CalendarModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const parsed = value ? new Date(`${value}T00:00:00`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  });
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const yearsRef = useRef<ScrollView>(null);

  // The modal stays mounted between openings, so without this it would reopen
  // on the month it was left on — showing one child's birth year while you
  // edit another's.
  useEffect(() => {
    if (!visible) return;

    const parsed = value ? new Date(`${value}T00:00:00`) : null;
    setView('days');
    setVisibleMonth(parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date());
  }, [visible, value]);

  const floor = minDate ? startOfDay(minDate) : null;
  const ceiling = maxDate ? startOfDay(maxDate) : null;

  const years = useMemo(() => {
    const lastYear = ceiling
      ? ceiling.getFullYear()
      : (floor ? floor.getFullYear() : new Date().getFullYear()) + DEFAULT_YEARS_AHEAD;
    const firstYear = floor ? floor.getFullYear() : lastYear - DEFAULT_YEARS_BACK;

    return Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, i) => firstYear + i);
  }, [floor, ceiling]);

  // Open the year list already showing the year in use, rather than at
  // whichever end of a century the list happens to start.
  useEffect(() => {
    if (view !== 'years') return;

    const index = years.indexOf(visibleMonth.getFullYear());
    if (index < 0) return;

    const offset = Math.max(0, Math.floor(index / 3) * YEAR_ROW_HEIGHT - YEAR_ROW_HEIGHT * 2);
    const frame = requestAnimationFrame(() =>
      yearsRef.current?.scrollTo({ y: offset, animated: false })
    );

    return () => cancelAnimationFrame(frame);
  }, [view, years, visibleMonth]);

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

  function shift(step: number) {
    setVisibleMonth((current) =>
      view === 'months'
        ? new Date(current.getFullYear() + step, current.getMonth(), 1)
        : new Date(current.getFullYear(), current.getMonth() + step, 1)
    );
  }

  /** A month is out of bounds only when none of its days can be picked. */
  function monthDisabled(month: number) {
    const year = visibleMonth.getFullYear();
    if (floor && new Date(year, month + 1, 0) < floor) return true;
    if (ceiling && new Date(year, month, 1) > ceiling) return true;
    return false;
  }

  const headerLabel =
    view === 'days'
      ? visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'months'
        ? String(visibleMonth.getFullYear())
        : `${years[0]} – ${years[years.length - 1]}`;

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
            {view === 'years' ? (
              <View style={styles.iconButton} />
            ) : (
              <AnimatedPressable style={styles.iconButton} onPress={() => shift(-1)}>
                <Ionicons name="chevron-back" size={18} color={colors.white} />
              </AnimatedPressable>
            )}

            {/* The label is the way into the year list and back out again. */}
            <AnimatedPressable
              style={styles.monthLabelButton}
              onPress={() => setView(view === 'days' ? 'years' : 'days')}
            >
              <Text style={styles.monthLabel}>{headerLabel}</Text>
              <Ionicons
                name={view === 'days' ? 'chevron-down' : 'chevron-up'}
                size={14}
                color={colors.grey}
              />
            </AnimatedPressable>

            {view === 'years' ? (
              <View style={styles.iconButton} />
            ) : (
              <AnimatedPressable style={styles.iconButton} onPress={() => shift(1)}>
                <Ionicons name="chevron-forward" size={18} color={colors.white} />
              </AnimatedPressable>
            )}
          </View>

          {view === 'years' ? (
            <ScrollView ref={yearsRef} style={styles.yearScroll}>
              <View style={styles.grid}>
                {years.map((year) => {
                  const isCurrent = year === visibleMonth.getFullYear();

                  return (
                    <View key={year} style={styles.thirdCell}>
                      <AnimatedSelectable
                        active={isCurrent}
                        style={styles.chip}
                        background={['transparent', colors.green]}
                        borderColor={['transparent', colors.borderGreen]}
                        onPress={() => {
                          setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
                          setView('months');
                        }}
                      >
                        <Text style={[styles.chipText, isCurrent && styles.chipTextSelected]}>
                          {year}
                        </Text>
                      </AnimatedSelectable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : view === 'months' ? (
            <View style={styles.grid}>
              {MONTH_NAMES.map((name, month) => {
                const disabled = monthDisabled(month);
                const isCurrent = month === visibleMonth.getMonth();

                return (
                  <View key={name} style={styles.thirdCell}>
                    <AnimatedSelectable
                      active={isCurrent}
                      disabled={disabled}
                      style={[styles.chip, disabled && styles.disabled]}
                      background={['transparent', colors.green]}
                      borderColor={['transparent', colors.borderGreen]}
                      onPress={() => {
                        setVisibleMonth(new Date(visibleMonth.getFullYear(), month, 1));
                        setView('days');
                      }}
                    >
                      <Text style={[styles.chipText, isCurrent && styles.chipTextSelected]}>
                        {name}
                      </Text>
                    </AnimatedSelectable>
                  </View>
                );
              })}
            </View>
          ) : (
            <>
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
                  const at = startOfDay(day);
                  const disabled =
                    (floor != null && at < floor) || (ceiling != null && at > ceiling);

                  return (
                    <AnimatedSelectable
                      key={iso}
                      active={isSelected}
                      disabled={disabled}
                      style={[styles.day, disabled && styles.disabled]}
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
            </>
          )}
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
    monthLabelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.round,
      backgroundColor: colors.cardSoft,
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
    // The year list is the only part that can outgrow the sheet, so it scrolls
    // while the header stays put.
    yearScroll: {
      maxHeight: YEAR_ROW_HEIGHT * 6,
    },
    thirdCell: {
      width: `${100 / 3}%`,
      height: YEAR_ROW_HEIGHT,
      padding: 4,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    chipText: {
      color: colors.greySoft,
      fontSize: scaleFont(13),
      fontWeight: '700',
    },
    chipTextSelected: {
      color: colors.white,
      fontWeight: '900',
    },
    day: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    disabled: {
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
