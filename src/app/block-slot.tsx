import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import HourDropdown from '../components/HourDropdown';
import RecurrencePicker, {
  initialRecurrence,
  RecurrenceValue,
  validateRecurrence,
} from '../components/RecurrencePicker';
import Screen from '../components/Screen';
import { useTranslation } from '../i18n/LanguageContext';
import { useAuth } from '../lib/auth';
import {
  AvailabilityRow,
  createPitchBlock,
  createRecurringPitchBlocks,
  fetchAgendaRange,
  fetchAvailability,
} from '../lib/pitchData';
import {
  addDays,
  bookableSpanForDay,
  buildBusyRanges,
  buildSlots,
  BusyRange,
  busyWithinSpan,
  dateAtMinutes,
  isPastDay,
  minutesToLabel,
  startOfDay,
} from '../lib/slots';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont, scaleLine } from '../theme/typography';

function formatRange(range: BusyRange) {
  const options = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
  return `${range.start.toLocaleTimeString([], options)}–${range.end.toLocaleTimeString(
    [],
    options
  )}`;
}

export default function BlockSlotScreen() {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ pitchId: string; date: string }>();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const day = useMemo(() => startOfDay(new Date(params.date)), [params.date]);

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [allDay, setAllDay] = useState(false);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(initialRecurrence);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [skippedNotice, setSkippedNotice] = useState<{ title: string; message: string } | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [availabilityRows, agenda] = await Promise.all([
          fetchAvailability(params.pitchId),
          fetchAgendaRange(params.pitchId, day, addDays(day, 1)),
        ]);

        if (isMounted) {
          setAvailability(availabilityRows);
          setBusy(buildBusyRanges(agenda.matches, agenda.blocks));
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t('blockSlot.errorLoadAvailability'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [day, params.pitchId]);

  // Fixed at mount so it doesn't change identity on every render.
  const now = useMemo(() => new Date(), []);
  const dayIsPast = isPastDay(day);

  // Times already gone are left out — a block cannot start in the past.
  const slots = useMemo(
    () => buildSlots({ availability, day, durationMinutes, busy, notBefore: now }),
    [availability, day, durationMinutes, busy, now]
  );

  const bookableSpan = useMemo(
    () => bookableSpanForDay(availability, day, now),
    [availability, day, now]
  );

  const allDayConflicts = useMemo(
    () => (bookableSpan ? busyWithinSpan(day, bookableSpan, busy) : []),
    [day, bookableSpan, busy]
  );

  useEffect(() => {
    setSelectedStart((current) =>
      current !== null && slots.some((slot) => slot.startMinutes === current && slot.isFree)
        ? current
        : null
    );
  }, [slots]);

  async function handleConfirm() {
    if (!session) return;

    if (!reason.trim()) {
      setErrorMessage(t('blockSlot.reasonRequired'));
      return;
    }

    let startTime: Date;
    let endTime: Date;

    if (allDay) {
      if (!bookableSpan) {
        setErrorMessage(
          dayIsPast
            ? t('blockSlot.errorDayPassed')
            : t('blockSlot.errorNoRemainingTime')
        );
        return;
      }

      if (allDayConflicts.length > 0) {
        setErrorMessage(
          t('blockSlot.errorDayConflict', { list: allDayConflicts.map(formatRange).join(', ') })
        );
        return;
      }

      startTime = dateAtMinutes(day, bookableSpan.startMinutes);
      endTime = dateAtMinutes(day, bookableSpan.endMinutes);
    } else {
      if (selectedStart === null) {
        setErrorMessage(t('blockSlot.errorSelectSlot'));
        return;
      }

      startTime = dateAtMinutes(day, selectedStart);
      endTime = dateAtMinutes(day, selectedStart + durationMinutes);
    }

    const { error: recurrenceError, untilDate } = validateRecurrence(recurrence, day, t);

    if (recurrenceError) {
      setErrorMessage(recurrenceError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (recurrence.enabled) {
        const result = await createRecurringPitchBlocks({
          pitchId: params.pitchId,
          startTime,
          endTime,
          repeatUntil: untilDate,
          openEnded: recurrence.openEnded,
          blockType: 'blocked',
          reason: reason.trim(),
        });

        if (result.created === 0) {
          setErrorMessage(t('blockSlot.errorEveryWeekTaken'));
          return;
        }

        if (result.skipped.length > 0) {
          const skippedList = result.skipped
            .map((iso) =>
              new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
            )
            .join(', ');

          setSkippedNotice({
            title: t('blockSlot.skippedTitle', { count: result.created }),
            message: t('blockSlot.skippedMessage', { list: skippedList }),
          });
          return;
        }
      } else {
        await createPitchBlock({
          pitchId: params.pitchId,
          startTime,
          endTime,
          blockType: 'blocked',
          reason: reason.trim(),
          createdBy: session.user.id,
        });
      }

      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('blockSlot.errorSave'));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (dayIsPast) {
    return (
      <Screen>
        <AppHeader title={t('blockSlot.title')} />
        <View style={styles.pastCard}>
          <Ionicons name="time-outline" size={18} color={colors.orange} />
          <Text style={styles.pastText}>
            {t('blockSlot.pastMessage', {
              date: day.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }),
            })}
          </Text>
        </View>
        <AppButton title={t('blockSlot.backToAgenda')} variant="outline" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={t('blockSlot.title')} />

      <Text style={styles.dateLabel}>
        {day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>

      <Text style={styles.sectionLabel}>{t('blockSlot.lengthStep')}</Text>
      <HourDropdown
        value={durationMinutes}
        onChange={setDurationMinutes}
        allDay={allDay}
        onAllDayChange={setAllDay}
      />

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
        {allDay ? t('blockSlot.wholeDayStep') : t('blockSlot.startTimeStep')}
      </Text>

      {isLoading ? (
        <Text style={styles.helperText}>{t('blockSlot.loadingAvailability')}</Text>
      ) : allDay ? (
        <View style={styles.allDayCard}>
          <Ionicons
            name={allDayConflicts.length > 0 ? 'alert-circle-outline' : 'moon-outline'}
            size={18}
            color={allDayConflicts.length > 0 ? colors.red : colors.greyDark}
          />
          <View style={styles.allDayTextWrap}>
            {bookableSpan ? (
              <>
                <Text style={styles.allDayValue}>
                  {minutesToLabel(bookableSpan.startMinutes)} –{' '}
                  {minutesToLabel(bookableSpan.endMinutes)}
                </Text>
                <Text style={styles.allDayHint}>
                  {allDayConflicts.length > 0
                    ? t('blockSlot.allDayConflict', { list: allDayConflicts.map(formatRange).join(', ') })
                    : bookableSpan.clamped
                      ? t('blockSlot.allDayClamped')
                      : t('blockSlot.allDayFull')}
                </Text>
              </>
            ) : (
              <Text style={styles.allDayValue}>{t('blockSlot.allDayNoOpen')}</Text>
            )}
          </View>
        </View>
      ) : slots.length === 0 ? (
        <Text style={styles.helperText}>
          {bookableSpan
            ? t('blockSlot.noSlotsLongEnough')
            : t('blockSlot.noOpenTime')}
        </Text>
      ) : (
        <View style={styles.slotGrid}>
          {slots.map((slot) => (
            <AnimatedPressable
              key={slot.startMinutes}
              disabled={!slot.isFree}
              style={[
                styles.slot,
                !slot.isFree && styles.slotDisabled,
                selectedStart === slot.startMinutes && styles.slotSelected,
              ]}
              onPress={() => setSelectedStart(slot.startMinutes)}
            >
              <Text
                style={[
                  styles.slotText,
                  !slot.isFree && styles.slotTextDisabled,
                  selectedStart === slot.startMinutes && styles.slotTextSelected,
                ]}
              >
                {slot.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
      )}

      <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>{t('blockSlot.reasonStep')}</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder={t('blockSlot.reasonPlaceholder')}
        placeholderTextColor={colors.greyDark}
        style={styles.input}
      />

      <RecurrencePicker startDay={day} value={recurrence} onChange={setRecurrence} />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.buttonRow}>
        <View style={styles.buttonHalf}>
          <AppButton title={t('common.cancel')} variant="outline" onPress={() => router.back()} />
        </View>
        <View style={styles.buttonHalf}>
          <AppButton
            title={
              recurrence.enabled
                ? t('blockSlot.blockWeekly')
                : allDay
                  ? t('blockSlot.blockWholeDay')
                  : t('blockSlot.blockButton')
            }
            onPress={handleConfirm}
            loading={isSubmitting}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={skippedNotice !== null}
        title={skippedNotice?.title ?? ''}
        message={skippedNotice?.message}
        actions={[{ label: t('common.ok'), onPress: () => router.back() }]}
        onDismiss={() => setSkippedNotice(null)}
      />
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    dateLabel: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '900',
      marginBottom: spacing.sm,
    },
    sectionLabelSpaced: {
      marginTop: spacing.lg,
    },
    helperText: {
      color: colors.greyDark,
      fontSize: scaleFont(13),
      fontWeight: '600',
    },
    pastCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
      backgroundColor: colors.orangeSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'rgba(255, 159, 10, 0.35)',
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    pastText: {
      flex: 1,
      color: colors.orange,
      fontSize: scaleFont(13),
      fontWeight: '600',
      lineHeight: scaleLine(19),
    },
    allDayCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    allDayTextWrap: {
      flex: 1,
    },
    allDayValue: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '900',
    },
    allDayHint: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginTop: 3,
      lineHeight: scaleLine(17),
    },
    slotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    slot: {
      width: '31%',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingVertical: 10,
      alignItems: 'center',
    },
    slotDisabled: {
      opacity: 0.4,
    },
    slotSelected: {
      borderColor: colors.greyDark,
      backgroundColor: colors.neutralSoft,
    },
    slotText: {
      color: colors.white,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    slotTextDisabled: {
      color: colors.greyDark,
    },
    slotTextSelected: {
      color: colors.white,
    },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardDark,
      color: colors.white,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: scaleFont(14),
      fontWeight: '600',
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(13),
      fontWeight: '700',
      marginTop: spacing.md,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xl,
    },
    buttonHalf: {
      flex: 1,
    },
  });
