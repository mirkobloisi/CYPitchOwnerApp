import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from '../../components/AnimatedPressable';
import AppHeader from '../../components/AppHeader';
import Screen from '../../components/Screen';
import StatusBadge from '../../components/StatusBadge';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import { fetchPayouts, MatchRow, PayoutRow } from '../../lib/pitchData';
import { supabase } from '../../lib/supabase';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont } from '../../theme/typography';

type PayoutFilter = 'all' | 'pending_confirmation' | 'paid' | 'failed';

export default function TransactionsScreen() {
  const { colors } = useAppTheme();
  const { activePitch } = useAuth();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const FILTERS: { key: PayoutFilter; label: string }[] = [
    { key: 'all', label: t('transactions.filterAll') },
    { key: 'pending_confirmation', label: t('transactions.filterPendingConfirmation') },
    { key: 'paid', label: t('transactions.filterPaid') },
    { key: 'failed', label: t('transactions.filterFailed') },
  ];

  const STATUS_META: Record<PayoutRow['status'], { label: string; tone: 'orange' | 'green' | 'red' }> = {
    pending_confirmation: { label: t('transactions.filterPendingConfirmation'), tone: 'orange' },
    paid: { label: t('transactions.filterPaid'), tone: 'green' },
    failed: { label: t('transactions.filterFailed'), tone: 'red' },
  };

  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [matchesById, setMatchesById] = useState<Record<string, MatchRow>>({});
  const [filter, setFilter] = useState<PayoutFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    if (!activePitch) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const rows = await fetchPayouts(activePitch.id);
      setPayouts(rows);

      const matchIds = rows.map((row) => row.match_id);
      if (matchIds.length > 0) {
        const { data, error } = await supabase
          .from('matches')
          .select('id, pitch_id, status, visibility, starts_at, ends_at, players_required, players_paid_count, pitch_price_total, confirmation_deadline, cancellation_reason')
          .in('id', matchIds);

        if (error) throw error;

        const map: Record<string, MatchRow> = {};
        (data ?? []).forEach((match) => {
          map[match.id] = match as MatchRow;
        });
        setMatchesById(map);
      } else {
        setMatchesById({});
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('transactions.couldNotLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [activePitch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredPayouts = payouts.filter((row) => filter === 'all' || row.status === filter);

  if (!activePitch) {
    return (
      <Screen>
        <AppHeader title={t('transactions.title')} showBack={false} />
        <Text style={styles.emptyText}>{t('transactions.noPitchLinked')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader
        title={t('transactions.title')}
        subtitle={t('transactions.subtitle')}
        showBack={false}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <AnimatedPressable
            key={option.key}
            style={[styles.filterChip, filter === option.key && styles.filterChipActive]}
            onPress={() => setFilter(option.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === option.key && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : filteredPayouts.length === 0 ? (
        <Text style={styles.emptyText}>{t('transactions.noTransactions')}</Text>
      ) : (
        filteredPayouts.map((payout) => {
          const match = matchesById[payout.match_id];
          const meta = STATUS_META[payout.status];

          return (
            <View key={payout.id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>
                  {match
                    ? new Date(match.starts_at).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : new Date(payout.created_at).toLocaleDateString()}
                </Text>
                {match ? (
                  <Text style={styles.rowTime}>
                    {new Date(match.starts_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    –
                    {new Date(match.ends_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.rowAmount}>
                €{Number(payout.amount).toFixed(2)}
              </Text>

              <StatusBadge label={meta.label} tone={meta.tone} />
            </View>
          );
        })
      )}
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(14),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    loading: {
      marginTop: spacing.xxl,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(13),
      fontWeight: '700',
      marginTop: spacing.lg,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterChipActive: {
      backgroundColor: colors.greenSoft,
      borderColor: colors.borderGreen,
    },
    filterChipText: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    filterChipTextActive: {
      color: colors.greenLight,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    rowLeft: {
      flex: 1,
    },
    rowDate: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    rowTime: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginTop: 2,
    },
    rowAmount: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '900',
    },
  });
