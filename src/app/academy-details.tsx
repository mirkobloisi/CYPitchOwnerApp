import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import AvatarCropModal from '../components/AvatarCropModal';
import AvatarPickerTrigger from '../components/AvatarPickerTrigger';
import Screen from '../components/Screen';
import { useTranslation } from '../i18n/LanguageContext';
import {
  AcademyRow,
  EnrolmentRow,
  SessionRow,
  ageFromDateOfBirth,
  deleteAcademy,
  fetchAcademy,
  fetchEnrolments,
  fetchSessions,
  respondToEnrolment,
  updateAcademy,
} from '../lib/academyData';
import { PickedAvatarImage, cropAndUploadAcademyLogo } from '../lib/avatarUpload';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';


export default function AcademyDetailsScreen() {
  const { academyId } = useLocalSearchParams<{ academyId: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [item, setItem] = useState<AcademyRow | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pickedLogo, setPickedLogo] = useState<PickedAvatarImage | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const load = useCallback(async () => {
    if (!academyId) return;

    const [row, enrolmentRows, trainings, matches] = await Promise.all([
      fetchAcademy(academyId),
      fetchEnrolments(academyId),
      fetchSessions(academyId, 'training'),
      fetchSessions(academyId, 'match'),
    ]);

    setItem(row);
    setEnrolments(enrolmentRows);
    setSessions([...trainings, ...matches].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));

    if (row) {
      setName(row.name);
      setCity(row.city ?? '');
      setDescription(row.description ?? '');
    }

    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!academyId || isSaving) return;

    setIsSaving(true);
    setSavedMessage('');
    setErrorMessage('');

    const { error } = await updateAcademy(academyId, {
      name: name.trim(),
      city: city.trim() || null,
      description: description.trim() || null,
    });

    setIsSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSavedMessage(t('academy.saved'));
    load();
  }

  function handleDelete() {
    if (!academyId) return;

    // Deleting takes its members, enrolments and schedule with it, so this
    // asks first rather than relying on an undo that doesn't exist.
    Alert.alert(t('academy.deleteTitle'), t('academy.deleteWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteAcademy(academyId);
          if (error) setErrorMessage(error.message);
          else router.back();
        },
      },
    ]);
  }

  async function respond(enrolmentId: string, approve: boolean) {
    await respondToEnrolment(enrolmentId, approve);
    load();
  }

  async function handleLogoCropped(crop: { originX: number; originY: number; size: number }) {
    if (!pickedLogo || !academyId) return;

    setIsUploadingLogo(true);
    setErrorMessage('');

    try {
      const url = await cropAndUploadAcademyLogo(academyId, pickedLogo, crop);
      await updateAcademy(academyId, { logo_url: url });
      setPickedLogo(null);
      load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('academy.logoFailed'));
    } finally {
      setIsUploadingLogo(false);
    }
  }

  const approved = enrolments.filter((row) => row.status === 'approved');
  const pending = enrolments.filter((row) => row.status === 'pending');
  const players = approved.filter((row) => row.member?.member_kind === 'player');
  const parents = approved.filter((row) => row.member?.member_kind === 'guardian');

  if (isLoading) {
    return (
      <Screen maxWidth={900}>
        <AppHeader title={t('academy.title')} />
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen maxWidth={900}>
        <AppHeader title={t('academy.title')} />
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('academy.notFound')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen maxWidth={900}>
      <AppHeader title={item.name} subtitle={item.city ?? undefined} />

      {/* The crest represents the academy wherever it appears — the list
          here, and the parents' app when they browse. */}
      <View style={styles.logoRow}>
        <AvatarPickerTrigger
          disabled={isUploadingLogo}
          onPicked={setPickedLogo}
          onError={(error) =>
            setErrorMessage(error instanceof Error ? error.message : t('academy.logoFailed'))
          }
        >
          <View style={styles.logoWrap}>
            {item.logo_url ? (
              <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="cover" />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Ionicons name="school" size={28} color={colors.greenLight} />
              </View>
            )}

            <View style={styles.logoBadge}>
              {isUploadingLogo ? (
                <ActivityIndicator color={colors.blackText} size="small" />
              ) : (
                <Ionicons name="camera" size={13} color={colors.blackText} />
              )}
            </View>
          </View>
        </AvatarPickerTrigger>

        <Text style={styles.logoHint}>{t('academy.logoHint')}</Text>
      </View>

      <View style={styles.statRow}>
        <Stat styles={styles} label={t('academy.tabPlayers')} value={players.length} />
        <Stat styles={styles} label={t('academy.tabParents')} value={parents.length} />
        <Stat styles={styles} label={t('academy.pendingTitle')} value={pending.length} />
        <Stat styles={styles} label={t('academy.tabSchedule')} value={sessions.length} />
      </View>

      <Text style={styles.heading}>{t('academy.tabPlayers')}</Text>

      <PeopleList
        styles={styles}
        colors={colors}
        t={t}
        people={players}
        pending={pending.filter((row) => row.member?.member_kind === 'player')}
        emptyText={t('academy.noPlayers')}
        onRespond={respond}
      />

      <Text style={styles.heading}>{t('academy.tabParents')}</Text>

      <PeopleList
        styles={styles}
        colors={colors}
        t={t}
        people={parents}
        pending={pending.filter((row) => row.member?.member_kind === 'guardian')}
        emptyText={t('academy.noParents')}
        onRespond={respond}
      />

      <Text style={styles.heading}>{t('academy.tabSchedule')}</Text>

      {sessions.length === 0 ? (
        <EmptyBox styles={styles} colors={colors} icon="time-outline">
          {t('academy.noSchedule')}
        </EmptyBox>
      ) : (
        sessions.map((session) => {
          const start = new Date(session.starts_at);

          return (
            <View key={session.id} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons
                  name={session.kind === 'match' ? 'trophy-outline' : 'time-outline'}
                  size={17}
                  color={session.kind === 'match' ? colors.blueLight : colors.greenLight}
                />
              </View>

              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{session.title}</Text>
                <Text style={styles.rowMeta}>
                  {[
                    start.toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }),
                    start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    session.location_name,
                    session.recurrence === 'weekly'
                      ? session.recurrence_until
                        ? t('academy.repeatsUntil').replace(
                            '{date}',
                            new Date(`${session.recurrence_until}T00:00:00`).toLocaleDateString(
                              undefined,
                              { day: 'numeric', month: 'short' }
                            )
                          )
                        : t('academy.repeatsForever')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.heading}>{t('academy.tabDetails')}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>{t('academy.namePlaceholder')}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>{t('academy.cityPlaceholder')}</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} />

        <Text style={styles.label}>{t('academy.descriptionLabel')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <AppButton
          title={t('common.save')}
          loading={isSaving}
          disabled={!name.trim()}
          onPress={handleSave}
        />

        <AnimatedPressable style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={16} color={colors.red} />
          <Text style={styles.deleteText}>{t('academy.deleteTitle')}</Text>
        </AnimatedPressable>
      </View>

      <AvatarCropModal
        visible={!!pickedLogo}
        imageUri={pickedLogo?.uri ?? null}
        imageWidth={pickedLogo?.width ?? 0}
        imageHeight={pickedLogo?.height ?? 0}
        onCancel={() => setPickedLogo(null)}
        onConfirm={handleLogoCropped}
      />
    </Screen>
  );
}

function PeopleList({
  styles,
  colors,
  t,
  people,
  pending,
  emptyText,
  onRespond,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  t: (key: string) => string;
  people: EnrolmentRow[];
  pending: EnrolmentRow[];
  emptyText: string;
  onRespond: (enrolmentId: string, approve: boolean) => void;
}) {
  return (
    <>
      {pending.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            {t('academy.pendingTitle')} ({pending.length})
          </Text>
          {pending.map((row) => (
            <PersonRow
              key={row.id}
              styles={styles}
              colors={colors}
              t={t}
              enrolment={row}
              onApprove={() => onRespond(row.id, true)}
              onReject={() => onRespond(row.id, false)}
            />
          ))}
        </>
      ) : null}

      {people.length === 0 ? (
        <EmptyBox styles={styles} colors={colors} icon="people-outline">
          {emptyText}
        </EmptyBox>
      ) : (
        people.map((row) => (
          <PersonRow key={row.id} styles={styles} colors={colors} t={t} enrolment={row} />
        ))
      )}
    </>
  );
}

function PersonRow({
  styles,
  colors,
  t,
  enrolment,
  onApprove,
  onReject,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  t: (key: string) => string;
  enrolment: EnrolmentRow;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const age = ageFromDateOfBirth(enrolment.member?.date_of_birth ?? null);
  const isPlayer = enrolment.member?.member_kind === 'player';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={isPlayer ? 'football-outline' : 'person'}
          size={17}
          color={isPlayer ? colors.blueLight : colors.greyDark}
        />
      </View>

      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{enrolment.member?.full_name ?? '—'}</Text>
        <Text style={styles.rowMeta}>
          {[
            isPlayer ? t('academy.playerLabel') : t('academy.guardianLabel'),
            age != null ? t('academy.ageValue').replace('{age}', String(age)) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {onApprove ? (
        <>
          <AnimatedPressable style={styles.approveButton} onPress={onApprove}>
            <Text style={styles.approveText}>{t('academy.approve')}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.iconButton} onPress={onReject}>
            <Ionicons name="close" size={16} color={colors.grey} />
          </AnimatedPressable>
        </>
      ) : null}
    </View>
  );
}

function Stat({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyBox({
  styles,
  colors,
  icon,
  children,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons name={icon} size={24} color={colors.greyDark} />
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    loading: {
      marginTop: spacing.xl,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    logoWrap: {
      width: 72,
      height: 72,
    },
    logo: {
      width: 72,
      height: 72,
      borderRadius: radius.lg,
    },
    logoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
    },
    logoBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
      borderWidth: 2,
      borderColor: colors.background,
    },
    logoHint: {
      flex: 1,
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      lineHeight: 17,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    statValue: {
      color: colors.white,
      fontSize: scaleFont(18),
      fontWeight: '900',
    },
    statLabel: {
      color: colors.greyDark,
      fontSize: scaleFont(10),
      fontWeight: '800',
      marginTop: 2,
      textAlign: 'center',
    },
    heading: {
      color: colors.greenLight,
      fontSize: scaleFont(12),
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    tabRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
      flexWrap: 'wrap',
    },
    tabChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
    },
    tabText: {
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    label: {
      color: colors.grey,
      fontSize: scaleFont(11),
      fontWeight: '800',
      marginBottom: 5,
    },
    input: {
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '600',
      marginBottom: spacing.md,
    },
    textArea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    savedText: {
      color: colors.greenLight,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: spacing.md,
      paddingVertical: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteText: {
      color: colors.red,
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
    sectionTitle: {
      color: colors.white,
      fontSize: scaleFont(13),
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.sm,
      marginBottom: 10,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    rowInfo: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    rowMeta: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginTop: 2,
    },
    approveButton: {
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      borderRadius: radius.round,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    approveText: {
      color: colors.greenLight,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      textAlign: 'center',
    },
  });
