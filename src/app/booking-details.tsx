import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import Screen from '../components/Screen';
import StatusBadge from '../components/StatusBadge';
import { useTranslation } from '../i18n/LanguageContext';
import { cancelConfirmedMatchUrgency, cancelPendingMatch, MatchRow } from '../lib/pitchData';
import { supabase } from '../lib/supabase';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export default function BookingDetailsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ matchId: string }>();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [match, setMatch] = useState<MatchRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState('');
  const [blockAfter, setBlockAfter] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ title: string; message: string } | null>(null);

  const [showUrgencyForm, setShowUrgencyForm] = useState(false);
  const [urgencyReason, setUrgencyReason] = useState('');
  const [isSubmittingUrgency, setIsSubmittingUrgency] = useState(false);
  const [urgencyErrorMessage, setUrgencyErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('matches')
        .select(
          'id, pitch_id, status, visibility, gender_category, starts_at, ends_at, players_required, players_paid_count, pitch_price_total, confirmation_deadline, cancellation_reason'
        )
        .eq('id', params.matchId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        setErrorMessage(error.message);
      } else {
        setMatch((data as MatchRow | null) ?? null);
      }

      setIsLoading(false);
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [params.matchId]);

  const isPending = match ? ['open', 'almost_full', 'fully_paid'].includes(match.status) : false;
  const canCancel =
    isPending &&
    match?.confirmation_deadline &&
    new Date(match.confirmation_deadline).getTime() > Date.now();

  // Distinct from canCancel above: a CONFIRMED match can only be cancelled
  // through the urgency path, and only up until it actually kicks off.
  const canUrgencyCancel =
    match?.status === 'confirmed' && new Date(match.starts_at).getTime() > Date.now();

  async function handleCancel() {
    if (!match || !reason.trim()) {
      setErrorMessage(t('bookingDetails.errorReasonRequired'));
      return;
    }

    if (blockAfter === null) {
      setErrorMessage(t('bookingDetails.errorAfterCancellingRequired'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await cancelPendingMatch(match.id, reason.trim(), blockAfter);
      setShowCancelForm(false);
      if (result.relocated) {
        setResultDialog({
          title: t('bookingDetails.cancelResultRelocatedTitle'),
          message: t('bookingDetails.cancelResultRelocatedMessage'),
        });
      } else {
        setResultDialog({
          title: t('bookingDetails.cancelResultCancelledTitle'),
          message: t('bookingDetails.cancelResultCancelledMessage'),
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('bookingDetails.errorCancel'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUrgencyCancel() {
    if (!match || !urgencyReason.trim()) {
      setUrgencyErrorMessage(t('bookingDetails.errorReasonRequired'));
      return;
    }

    setIsSubmittingUrgency(true);
    setUrgencyErrorMessage('');

    try {
      const result = await cancelConfirmedMatchUrgency(match.id, urgencyReason.trim());
      setShowUrgencyForm(false);

      if (result.clawbackRequired) {
        setResultDialog({
          title: t('bookingDetails.urgencyResultTitleClawback'),
          message: t('bookingDetails.urgencyResultMessageClawback', {
            amount: (result.clawbackAmount ?? 0).toFixed(2),
          }),
        });
      } else {
        setResultDialog({
          title: t('bookingDetails.urgencyResultTitleNoClawback'),
          message: t('bookingDetails.urgencyResultMessageNoClawback'),
        });
      }
    } catch (error) {
      setUrgencyErrorMessage(error instanceof Error ? error.message : t('bookingDetails.errorUrgencyCancel'));
    } finally {
      setIsSubmittingUrgency(false);
    }
  }

  const statusMeta: Record<string, { label: string; tone: 'orange' | 'green' | 'blue' | 'neutral' }> = {
    open: { label: t('bookingDetails.statusPendingConfirmation'), tone: 'orange' },
    almost_full: { label: t('bookingDetails.statusPendingConfirmation'), tone: 'orange' },
    fully_paid: { label: t('bookingDetails.statusPendingConfirmation'), tone: 'orange' },
    confirmed: { label: t('bookingDetails.statusConfirmedPaid'), tone: 'green' },
    completed: { label: t('bookingDetails.statusCompleted'), tone: 'blue' },
    cancelled: { label: t('bookingDetails.statusCancelled'), tone: 'neutral' },
  };

  return (
    <Screen>
      <AppHeader title={t('bookingDetails.title')} />

      {isLoading ? (
        <Text style={styles.helperText}>{t('bookingDetails.loading')}</Text>
      ) : !match ? (
        <Text style={styles.helperText}>{t('bookingDetails.notFound')}</Text>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.dateText}>
                {new Date(match.starts_at).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              <StatusBadge
                label={statusMeta[match.status]?.label ?? match.status}
                tone={statusMeta[match.status]?.tone ?? 'neutral'}
              />
            </View>

            <Text style={styles.timeText}>
              {new Date(match.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
              {new Date(match.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookingDetails.playersJoined')}</Text>
              <Text style={styles.infoValue}>
                {match.players_paid_count}/{match.players_required}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookingDetails.expectedPayout')}</Text>
              <Text style={styles.infoValue}>€{Number(match.pitch_price_total).toFixed(2)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('bookingDetails.genderCategory')}</Text>
              <Text style={styles.infoValue}>
                {match.gender_category === 'male'
                  ? t('bookingDetails.genderMenOnly')
                  : match.gender_category === 'female'
                  ? t('bookingDetails.genderWomenOnly')
                  : t('bookingDetails.genderMixed')}
              </Text>
            </View>

            {match.cancellation_reason ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('bookingDetails.cancellationReason')}</Text>
                <Text style={styles.infoValue}>{match.cancellation_reason}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.noticeBox}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.grey} />
            <Text style={styles.noticeText}>{t('bookingDetails.privacyNotice')}</Text>
          </View>

          {canCancel && !showCancelForm ? (
            <View style={styles.cancelSection}>
              <AppButton
                title={t('bookingDetails.cancelMatch')}
                variant="danger"
                onPress={() => setShowCancelForm(true)}
              />
            </View>
          ) : null}

          {canCancel && showCancelForm ? (
            <View style={styles.cancelForm}>
              <Text style={styles.fieldLabel}>{t('bookingDetails.reasonRequiredLabel')}</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={t('bookingDetails.reasonPlaceholder')}
                placeholderTextColor={colors.greyDark}
                style={styles.input}
                multiline
              />

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{t('bookingDetails.afterCancelling')}</Text>
              <View style={styles.choiceRow}>
                <AnimatedPressable
                  style={[styles.choiceChip, blockAfter === true && styles.choiceChipActive]}
                  onPress={() => setBlockAfter(true)}
                >
                  <Text style={[styles.choiceChipText, blockAfter === true && styles.choiceChipTextActive]}>
                    {t('bookingDetails.blockThisSlot')}
                  </Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[styles.choiceChip, blockAfter === false && styles.choiceChipActive]}
                  onPress={() => setBlockAfter(false)}
                >
                  <Text style={[styles.choiceChipText, blockAfter === false && styles.choiceChipTextActive]}>
                    {t('bookingDetails.makeAvailableAgain')}
                  </Text>
                </AnimatedPressable>
              </View>

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <View style={styles.buttonRow}>
                <View style={styles.buttonHalf}>
                  <AppButton
                    title={t('bookingDetails.back')}
                    variant="outline"
                    onPress={() => setShowCancelForm(false)}
                  />
                </View>
                <View style={styles.buttonHalf}>
                  <AppButton
                    title={t('bookingDetails.confirmCancellation')}
                    variant="danger"
                    onPress={handleCancel}
                    loading={isSubmitting}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {errorMessage && !showCancelForm ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          {canUrgencyCancel && !showUrgencyForm ? (
            <View style={styles.cancelSection}>
              <AppButton
                title={t('bookingDetails.urgencyCancelButton')}
                variant="danger"
                onPress={() => setShowUrgencyForm(true)}
              />
            </View>
          ) : null}

          {canUrgencyCancel && showUrgencyForm ? (
            <View style={styles.cancelForm}>
              <View style={styles.urgencyIntroRow}>
                <Ionicons name="warning-outline" size={16} color={colors.red} />
                <Text style={styles.urgencyIntroText}>{t('bookingDetails.urgencyCancelIntro')}</Text>
              </View>

              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
                {t('bookingDetails.reasonRequiredLabel')}
              </Text>
              <TextInput
                value={urgencyReason}
                onChangeText={setUrgencyReason}
                placeholder={t('bookingDetails.urgencyReasonPlaceholder')}
                placeholderTextColor={colors.greyDark}
                style={styles.input}
                multiline
              />

              {urgencyErrorMessage ? <Text style={styles.errorText}>{urgencyErrorMessage}</Text> : null}

              <View style={styles.buttonRow}>
                <View style={styles.buttonHalf}>
                  <AppButton
                    title={t('bookingDetails.back')}
                    variant="outline"
                    onPress={() => setShowUrgencyForm(false)}
                  />
                </View>
                <View style={styles.buttonHalf}>
                  <AppButton
                    title={t('bookingDetails.urgencyConfirmCancellation')}
                    variant="danger"
                    onPress={handleUrgencyCancel}
                    loading={isSubmittingUrgency}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </>
      )}

      <ConfirmDialog
        visible={resultDialog !== null}
        title={resultDialog?.title ?? ''}
        message={resultDialog?.message}
        actions={[{ label: t('bookingDetails.resultOk') }]}
        onDismiss={() => {
          setResultDialog(null);
          router.back();
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    helperText: {
      color: colors.greyDark,
      fontSize: scaleFont(13),
      fontWeight: '600',
    },
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: {
      color: colors.white,
      fontSize: scaleFont(16),
      fontWeight: '900',
    },
    timeText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '700',
      marginTop: 4,
      marginBottom: spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    infoLabel: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '700',
    },
    infoValue: {
      color: colors.white,
      fontSize: scaleFont(13),
      fontWeight: '800',
      flexShrink: 1,
      textAlign: 'right',
      marginLeft: spacing.md,
    },
    noticeBox: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      backgroundColor: colors.neutralSoft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    noticeText: {
      flex: 1,
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
    },
    cancelSection: {
      marginTop: spacing.sm,
    },
    cancelForm: {
      marginTop: spacing.sm,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: 'rgba(255, 69, 58, 0.35)',
      backgroundColor: colors.redSoft,
      padding: spacing.lg,
    },
    urgencyIntroRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
    },
    urgencyIntroText: {
      flex: 1,
      color: colors.red,
      fontSize: scaleFont(12.5),
      fontWeight: '700',
      lineHeight: scaleFont(18),
    },
    fieldLabel: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    fieldLabelSpaced: {
      marginTop: spacing.md,
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
      minHeight: 70,
      textAlignVertical: 'top',
    },
    choiceRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    choiceChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
    },
    choiceChipActive: {
      borderColor: colors.greyDark,
      backgroundColor: colors.neutralSoft,
    },
    choiceChipText: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    choiceChipTextActive: {
      color: colors.white,
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
      marginTop: spacing.lg,
    },
    buttonHalf: {
      flex: 1,
    },
  });
