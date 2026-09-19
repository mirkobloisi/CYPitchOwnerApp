import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppHeader from '../../components/AppHeader';
import BarChart, { BarChartPoint } from '../../components/BarChart';
import GrowthPill from '../../components/GrowthPill';
import Screen from '../../components/Screen';
import SectionHeader from '../../components/SectionHeader';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { withAbortableTimeout } from '../../lib/withTimeout';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont } from '../../theme/typography';

const REQUEST_TIMEOUT_MS = 15000;

type MatchStatRow = {
  pitch_id: string;
  status: string;
  starts_at: string;
  pitch_price_total: number;
};

type PayoutStatRow = {
  pitch_id: string;
  amount: number;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return ((current - previous) / previous) * 100;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
}

export default function StatsScreen() {
  const { colors } = useAppTheme();
  const { pitches } = useAuth();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [matches, setMatches] = useState<MatchStatRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutStatRow[]>([]);

  const pitchIds = useMemo(() => pitches.map((p) => p.id), [pitches]);

  const load = useCallback(async () => {
    if (pitchIds.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    const sinceDate = new Date(Date.now() - 60 * DAY_MS).toISOString();

    try {
      // These queries were previously awaited with no timeout at all — a
      // stalled connection here (e.g. after the browser tab sat idle) meant
      // this screen's spinner really would never resolve, no matter what
      // else was fixed elsewhere. withAbortableTimeout both bounds the wait
      // and cancels the request when it fires, so it can't tie up a
      // connection slot other screens need. See withTimeout.ts.
      const [matchesRes, payoutsRes] = await Promise.all([
        withAbortableTimeout(
          supabase
            .from('matches')
            .select('pitch_id, status, starts_at, pitch_price_total')
            .in('pitch_id', pitchIds)
            .gte('starts_at', sinceDate),
          REQUEST_TIMEOUT_MS,
          'stats.matches'
        ),
        withAbortableTimeout(
          supabase
            .from('pitch_payouts')
            .select('pitch_id, amount, created_at')
            .in('pitch_id', pitchIds)
            .gte('created_at', sinceDate),
          REQUEST_TIMEOUT_MS,
          'stats.payouts'
        ),
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (payoutsRes.error) throw payoutsRes.error;

      setMatches((matchesRes.data ?? []) as MatchStatRow[]);
      setPayouts((payoutsRes.data ?? []) as PayoutStatRow[]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('stats.couldNotLoad'));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitchIds.join(',')]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const now = Date.now();
  const last30Start = now - 30 * DAY_MS;
  const prev30Start = now - 60 * DAY_MS;

  const matchesLast30 = matches.filter((m) => new Date(m.starts_at).getTime() >= last30Start);
  const matchesPrev30 = matches.filter((m) => {
    const t = new Date(m.starts_at).getTime();
    return t >= prev30Start && t < last30Start;
  });

  const payoutsLast30 = payouts.filter((p) => new Date(p.created_at).getTime() >= last30Start);
  const payoutsPrev30 = payouts.filter((p) => {
    const t = new Date(p.created_at).getTime();
    return t >= prev30Start && t < last30Start;
  });

  const revenueLast30 = payoutsLast30.reduce((sum, p) => sum + Number(p.amount), 0);
  const revenuePrev30 = payoutsPrev30.reduce((sum, p) => sum + Number(p.amount), 0);

  const reservationsLast30 = matchesLast30.filter((m) => m.status !== 'cancelled').length;
  const reservationsPrev30 = matchesPrev30.filter((m) => m.status !== 'cancelled').length;

  const nonCancelledLast30 = matchesLast30.filter((m) => m.status !== 'cancelled');
  const confirmedLast30 = nonCancelledLast30.filter((m) => m.status === 'confirmed' || m.status === 'completed');
  const confirmationRate = nonCancelledLast30.length > 0
    ? (confirmedLast30.length / nonCancelledLast30.length) * 100
    : null;

  // Last 7 days, oldest first, for the two mini charts below.
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * DAY_MS);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const reservationsPerDay: BarChartPoint[] = last7Days.map((day) => {
    const dayEnd = day.getTime() + DAY_MS;
    const count = matches.filter((m) => {
      const t = new Date(m.starts_at).getTime();
      return t >= day.getTime() && t < dayEnd && m.status !== 'cancelled';
    }).length;
    return { label: dayLabel(day), value: count };
  });

  const revenuePerDay: BarChartPoint[] = last7Days.map((day) => {
    const dayEnd = day.getTime() + DAY_MS;
    const total = payouts
      .filter((p) => {
        const t = new Date(p.created_at).getTime();
        return t >= day.getTime() && t < dayEnd;
      })
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { label: dayLabel(day), value: total };
  });

  if (pitches.length === 0) {
    return (
      <Screen>
        <AppHeader title={t('stats.title')} showBack={false} />
        <Text style={styles.emptyText}>{t('stats.noPitchLinked')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title={t('stats.title')} subtitle={t('stats.subtitle')} showBack={false} />

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : (
        <>
          <View style={styles.statGrid}>
            <StatCard
              styles={styles}
              label={t('stats.revenue')}
              value={`€${revenueLast30.toFixed(0)}`}
              pctChange={pctChange(revenueLast30, revenuePrev30)}
            />
            <StatCard
              styles={styles}
              label={t('stats.reservations')}
              value={String(reservationsLast30)}
              pctChange={pctChange(reservationsLast30, reservationsPrev30)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('stats.confirmationRate')}</Text>
            <Text style={styles.cardSubtitle}>{t('stats.confirmationRateSubtitle')}</Text>
            <View style={styles.rateBarTrack}>
              <View
                style={[
                  styles.rateBarFill,
                  { width: `${Math.max(0, Math.min(100, confirmationRate ?? 0))}%` },
                ]}
              />
            </View>
            <Text style={styles.rateValue}>
              {confirmationRate === null ? t('stats.noReservationsYet') : `${confirmationRate.toFixed(0)}%`}
            </Text>
          </View>

          <SectionHeader title={t('stats.reservationsLast7')} />
          <View style={styles.card}>
            <BarChart data={reservationsPerDay} />
          </View>

          <SectionHeader title={t('stats.revenueLast7')} />
          <View style={styles.card}>
            <BarChart data={revenuePerDay} />
          </View>
        </>
      )}
    </Screen>
  );
}

function StatCard({
  styles,
  label,
  value,
  pctChange: change,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
  pctChange: number | null;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <GrowthPill pctChange={change} />
    </View>
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
    statGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: 6,
    },
    statLabel: {
      color: colors.grey,
      fontSize: scaleFont(11.5),
      fontWeight: '700',
    },
    statValue: {
      color: colors.white,
      fontSize: scaleFont(22),
      fontWeight: '900',
    },
    card: {
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    cardTitle: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    cardSubtitle: {
      color: colors.grey,
      fontSize: scaleFont(11.5),
      fontWeight: '600',
      marginTop: 3,
      marginBottom: spacing.sm,
    },
    rateBarTrack: {
      height: 10,
      borderRadius: radius.round,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    rateBarFill: {
      height: '100%',
      borderRadius: radius.round,
      backgroundColor: colors.greenLight,
    },
    rateValue: {
      marginTop: 8,
      color: colors.white,
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
  });
