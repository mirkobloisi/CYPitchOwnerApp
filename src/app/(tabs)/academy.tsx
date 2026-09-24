import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../../components/AnimatedPressable';
import AnimatedSelectable from '../../components/AnimatedSelectable';
import AnimatedSwap from '../../components/AnimatedSwap';
import AppButton from '../../components/AppButton';
import AppHeader from '../../components/AppHeader';
import Screen from '../../components/Screen';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import {
  AcademyRow,
  EnrolmentRow,
  ageFromDateOfBirth,
  createAcademy,
  fetchEnrolments,
  fetchMyAcademies,
  respondToEnrolment,
} from '../../lib/academyData';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont } from '../../theme/typography';

export default function AcademyScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { pitchOwner } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [academies, setAcademies] = useState<AcademyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const rows = await fetchMyAcademies();
    setAcademies(rows);

    const nextSelected = selectedId && rows.some((a) => a.id === selectedId)
      ? selectedId
      : rows[0]?.id ?? null;
    setSelectedId(nextSelected);

    setEnrolments(nextSelected ? await fetchEnrolments(nextSelected) : []);
    setIsLoading(false);
    // selectedId is intentionally not a dependency: including it would refetch
    // every academy each time the owner switches between them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function selectAcademy(academyId: string) {
    setSelectedId(academyId);
    setEnrolments(await fetchEnrolments(academyId));
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !pitchOwner?.id || isCreating) return;

    setIsCreating(true);
    setErrorMessage('');

    const { error } = await createAcademy({
      pitchOwnerId: pitchOwner.id,
      name,
      city: newCity,
    });

    setIsCreating(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setNewName('');
    setNewCity('');
    setShowCreate(false);
    load();
  }

  async function respond(enrolmentId: string, approve: boolean) {
    await respondToEnrolment(enrolmentId, approve);
    if (selectedId) setEnrolments(await fetchEnrolments(selectedId));
  }

  const pending = enrolments.filter((e) => e.status === 'pending');
  const approved = enrolments.filter((e) => e.status === 'approved');

  return (
    <Screen maxWidth={900}>
      <AppHeader
        title={t('academy.title')}
        subtitle={t('academy.subtitle')}
        showBack={false}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : (
        <>
          {academies.length > 0 ? (
            <View style={styles.academyRow}>
              {academies.map((item) => (
                <AnimatedSelectable
                  key={item.id}
                  active={item.id === selectedId}
                  style={styles.academyChip}
                  background={[colors.card, colors.greenSoft]}
                  borderColor={[colors.border, colors.borderGreen]}
                  onPress={() => selectAcademy(item.id)}
                >
                  {(progress) => (
                    <Animated.Text
                      style={[
                        styles.academyChipText,
                        {
                          color: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [colors.grey, colors.greenLight],
                          }),
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Animated.Text>
                  )}
                </AnimatedSelectable>
              ))}
            </View>
          ) : null}

          {showCreate ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('academy.createTitle')}</Text>

              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder={t('academy.namePlaceholder')}
                placeholderTextColor={colors.greyDark}
              />
              <TextInput
                style={styles.input}
                value={newCity}
                onChangeText={setNewCity}
                placeholder={t('academy.cityPlaceholder')}
                placeholderTextColor={colors.greyDark}
              />

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

              <View style={styles.formActions}>
                <AppButton
                  title={t('common.cancel')}
                  variant="outline"
                  fullWidth={false}
                  style={styles.formButton}
                  onPress={() => {
                    setShowCreate(false);
                    setErrorMessage('');
                  }}
                />
                <AppButton
                  title={t('academy.createAction')}
                  loading={isCreating}
                  disabled={!newName.trim()}
                  fullWidth={false}
                  style={styles.formButton}
                  onPress={handleCreate}
                />
              </View>
            </View>
          ) : (
            <AnimatedPressable
              style={styles.createButton}
              hoverScale={1.02}
              onPress={() => setShowCreate(true)}
            >
              <Ionicons name="add" size={18} color={colors.blackText} />
              <Text style={styles.createButtonText}>{t('academy.createAction')}</Text>
            </AnimatedPressable>
          )}

          {academies.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="school-outline" size={26} color={colors.greyDark} />
              <Text style={styles.emptyText}>{t('academy.noAcademies')}</Text>
            </View>
          ) : (
            <AnimatedSwap swapKey={selectedId ?? 'none'}>
              <Text style={styles.sectionTitle}>
                {t('academy.pendingTitle')} ({pending.length})
              </Text>

              {pending.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{t('academy.noPending')}</Text>
                </View>
              ) : (
                pending.map((enrolment) => (
                  <MemberRow
                    key={enrolment.id}
                    styles={styles}
                    colors={colors}
                    enrolment={enrolment}
                    t={t}
                    onApprove={() => respond(enrolment.id, true)}
                    onReject={() => respond(enrolment.id, false)}
                  />
                ))
              )}

              <Text style={styles.sectionTitle}>
                {t('academy.membersTitle')} ({approved.length})
              </Text>

              {approved.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>{t('academy.noMembers')}</Text>
                </View>
              ) : (
                approved.map((enrolment) => (
                  <MemberRow
                    key={enrolment.id}
                    styles={styles}
                    colors={colors}
                    enrolment={enrolment}
                    t={t}
                  />
                ))
              )}
            </AnimatedSwap>
          )}
        </>
      )}
    </Screen>
  );
}

function MemberRow({
  styles,
  colors,
  enrolment,
  t,
  onApprove,
  onReject,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  enrolment: EnrolmentRow;
  t: (key: string) => string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const age = ageFromDateOfBirth(enrolment.member?.date_of_birth ?? null);
  const isChild = enrolment.member?.guardian_id != null;

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Ionicons
          name={isChild ? 'happy-outline' : 'person'}
          size={18}
          color={isChild ? colors.blueLight : colors.greyDark}
        />
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{enrolment.member?.full_name ?? '—'}</Text>
        <Text style={styles.memberMeta}>
          {[
            isChild ? t('academy.childLabel') : t('academy.guardianLabel'),
            age != null ? t('academy.ageValue').replace('{age}', String(age)) : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>

      {onApprove ? (
        <>
          <AnimatedPressable style={styles.approveButton} onPress={onApprove}>
            <Text style={styles.approveText}>{t('academy.approve')}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.rejectButton} onPress={onReject}>
            <Ionicons name="close" size={16} color={colors.grey} />
          </AnimatedPressable>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    loading: {
      marginTop: spacing.xl,
    },
    academyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    academyChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
      maxWidth: 220,
    },
    academyChipText: {
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    cardTitle: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '800',
      marginBottom: spacing.sm,
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
      marginBottom: spacing.sm,
    },
    formActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: 4,
    },
    formButton: {
      minWidth: 130,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.greenLight,
      borderRadius: radius.lg,
      paddingVertical: 13,
      marginBottom: spacing.md,
    },
    createButtonText: {
      color: colors.blackText,
      fontSize: scaleFont(14),
      fontWeight: '900',
    },
    sectionTitle: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    memberRow: {
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
    memberAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    memberInfo: {
      flex: 1,
      minWidth: 0,
    },
    memberName: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    memberMeta: {
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
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    approveText: {
      color: colors.greenLight,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    rejectButton: {
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
    errorText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
  });
