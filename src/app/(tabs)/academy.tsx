import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  SessionKind,
  SessionRow,
  ageFromDateOfBirth,
  cancelSession,
  createAcademy,
  createSessions,
  deleteSession,
  fetchEnrolments,
  fetchMyAcademies,
  fetchSessions,
  respondToEnrolment,
} from '../../lib/academyData';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont } from '../../theme/typography';

type SubTab = 'academies' | 'players' | 'parents' | 'trainings' | 'matches' | 'messages';

const SUB_TABS: { key: SubTab; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'academies', labelKey: 'academy.tabAcademies', icon: 'school-outline' },
  { key: 'players', labelKey: 'academy.tabPlayers', icon: 'football-outline' },
  { key: 'parents', labelKey: 'academy.tabParents', icon: 'people-outline' },
  { key: 'trainings', labelKey: 'academy.tabTrainings', icon: 'time-outline' },
  { key: 'matches', labelKey: 'academy.tabMatches', icon: 'trophy-outline' },
  { key: 'messages', labelKey: 'academy.tabMessages', icon: 'chatbubbles-outline' },
];

export default function AcademyScreen() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { pitchOwner } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [subTab, setSubTab] = useState<SubTab>('academies');
  const [academies, setAcademies] = useState<AcademyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrolments, setEnrolments] = useState<EnrolmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [sessionDuration, setSessionDuration] = useState('90');
  const [sessionLocation, setSessionLocation] = useState('');
  const [sessionMapsUrl, setSessionMapsUrl] = useState('');
  const [sessionOpponent, setSessionOpponent] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    const rows = await fetchMyAcademies();
    setAcademies(rows);

    setSelectedId((current) => {
      const next = current && rows.some((a) => a.id === current) ? current : rows[0]?.id ?? null;
      if (next) fetchEnrolments(next).then(setEnrolments);
      else setEnrolments([]);
      return next;
    });

    setIsLoading(false);
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

  const sessionKind: SessionKind = subTab === 'matches' ? 'match' : 'training';

  const loadSessions = useCallback(async () => {
    if (!selectedId) {
      setSessions([]);
      return;
    }
    setSessions(await fetchSessions(selectedId, sessionKind));
  }, [selectedId, sessionKind]);

  useEffect(() => {
    if (subTab === 'trainings' || subTab === 'matches') loadSessions();
  }, [subTab, loadSessions]);

  async function handleCreateSession() {
    if (!selectedId || isCreating) return;

    // Times are entered as plain local date/time; build the instant from them.
    const startsAt = new Date(`${sessionDate}T${sessionTime}`);
    if (Number.isNaN(startsAt.getTime())) {
      setErrorMessage(t('academy.invalidDateTime'));
      return;
    }

    const minutes = Number(sessionDuration) || 90;
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    setIsCreating(true);
    setErrorMessage('');

    const { error } = await createSessions({
      academyId: selectedId,
      kind: sessionKind,
      title: sessionTitle,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      locationName: sessionLocation,
      mapsUrl: sessionMapsUrl,
      opponent: sessionKind === 'match' ? sessionOpponent : null,
      repeatWeekly,
      repeatUntil: repeatWeekly ? repeatUntil : null,
    });

    setIsCreating(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSessionTitle('');
    setSessionDate('');
    setSessionTime('');
    setSessionLocation('');
    setSessionMapsUrl('');
    setSessionOpponent('');
    setRepeatWeekly(false);
    setRepeatUntil('');
    setShowSessionForm(false);
    loadSessions();
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !pitchOwner?.id || isCreating) return;

    setIsCreating(true);
    setErrorMessage('');

    const { error } = await createAcademy({ pitchOwnerId: pitchOwner.id, name, city: newCity });
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
  const players = approved.filter((e) => e.member?.member_kind === 'player');
  const parents = approved.filter((e) => e.member?.member_kind === 'guardian');

  const hasAcademies = academies.length > 0;

  return (
    <Screen maxWidth={900}>
      <AppHeader title={t('academy.title')} subtitle={t('academy.subtitle')} showBack={false} />

      {/* Which academy the tabs below act on. */}
      {hasAcademies ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
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
                    styles.chipText,
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
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {SUB_TABS.map((tab) => (
          <AnimatedSelectable
            key={tab.key}
            active={subTab === tab.key}
            style={styles.subTabChip}
            background={[colors.card, colors.blueSoft]}
            borderColor={[colors.border, colors.borderBlue]}
            onPress={() => setSubTab(tab.key)}
          >
            {(progress) => (
              <Animated.Text
                style={[
                  styles.chipText,
                  {
                    color: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [colors.grey, colors.blueLight],
                    }),
                  },
                ]}
              >
                {t(tab.labelKey)}
              </Animated.Text>
            )}
          </AnimatedSelectable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : (
        <AnimatedSwap swapKey={`${subTab}:${selectedId ?? 'none'}`}>
          {subTab === 'academies' ? (
            <>
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

              {!hasAcademies ? (
                <EmptyBox styles={styles} colors={colors} icon="school-outline">
                  {t('academy.noAcademies')}
                </EmptyBox>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>
                    {t('academy.pendingTitle')} ({pending.length})
                  </Text>

                  {pending.length === 0 ? (
                    <EmptyBox styles={styles} colors={colors}>
                      {t('academy.noPending')}
                    </EmptyBox>
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
                </>
              )}
            </>
          ) : subTab === 'players' ? (
            players.length === 0 ? (
              <EmptyBox styles={styles} colors={colors} icon="football-outline">
                {t('academy.noPlayers')}
              </EmptyBox>
            ) : (
              players.map((enrolment) => (
                <MemberRow
                  key={enrolment.id}
                  styles={styles}
                  colors={colors}
                  enrolment={enrolment}
                  t={t}
                />
              ))
            )
          ) : subTab === 'parents' ? (
            parents.length === 0 ? (
              <EmptyBox styles={styles} colors={colors} icon="people-outline">
                {t('academy.noParents')}
              </EmptyBox>
            ) : (
              parents.map((enrolment) => (
                <MemberRow
                  key={enrolment.id}
                  styles={styles}
                  colors={colors}
                  enrolment={enrolment}
                  t={t}
                />
              ))
            )
          ) : subTab === 'trainings' || subTab === 'matches' ? (
            !hasAcademies ? (
              <EmptyBox styles={styles} colors={colors} icon="school-outline">
                {t('academy.noAcademies')}
              </EmptyBox>
            ) : (
              <>
                {showSessionForm ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {sessionKind === 'match'
                        ? t('academy.newMatchTitle')
                        : t('academy.newTrainingTitle')}
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={sessionTitle}
                      onChangeText={setSessionTitle}
                      placeholder={t('academy.sessionTitlePlaceholder')}
                      placeholderTextColor={colors.greyDark}
                    />

                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.inputHalf]}
                        value={sessionDate}
                        onChangeText={setSessionDate}
                        placeholder={t('academy.datePlaceholder')}
                        placeholderTextColor={colors.greyDark}
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={[styles.input, styles.inputHalf]}
                        value={sessionTime}
                        onChangeText={setSessionTime}
                        placeholder={t('academy.timePlaceholder')}
                        placeholderTextColor={colors.greyDark}
                        autoCapitalize="none"
                      />
                    </View>

                    <TextInput
                      style={styles.input}
                      value={sessionDuration}
                      onChangeText={setSessionDuration}
                      placeholder={t('academy.durationPlaceholder')}
                      placeholderTextColor={colors.greyDark}
                      keyboardType="number-pad"
                    />

                    {sessionKind === 'match' ? (
                      <TextInput
                        style={styles.input}
                        value={sessionOpponent}
                        onChangeText={setSessionOpponent}
                        placeholder={t('academy.opponentPlaceholder')}
                        placeholderTextColor={colors.greyDark}
                      />
                    ) : null}

                    <TextInput
                      style={styles.input}
                      value={sessionLocation}
                      onChangeText={setSessionLocation}
                      placeholder={t('academy.locationPlaceholder')}
                      placeholderTextColor={colors.greyDark}
                    />
                    <TextInput
                      style={styles.input}
                      value={sessionMapsUrl}
                      onChangeText={setSessionMapsUrl}
                      placeholder={t('academy.mapsUrlPlaceholder')}
                      placeholderTextColor={colors.greyDark}
                      autoCapitalize="none"
                    />

                    <AnimatedPressable
                      style={styles.toggleRow}
                      onPress={() => setRepeatWeekly((value) => !value)}
                    >
                      <Ionicons
                        name={repeatWeekly ? 'checkbox' : 'square-outline'}
                        size={19}
                        color={repeatWeekly ? colors.greenLight : colors.greyDark}
                      />
                      <Text style={styles.toggleText}>{t('academy.repeatWeekly')}</Text>
                    </AnimatedPressable>

                    {repeatWeekly ? (
                      <TextInput
                        style={styles.input}
                        value={repeatUntil}
                        onChangeText={setRepeatUntil}
                        placeholder={t('academy.repeatUntilPlaceholder')}
                        placeholderTextColor={colors.greyDark}
                        autoCapitalize="none"
                      />
                    ) : null}

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <View style={styles.formActions}>
                      <AppButton
                        title={t('common.cancel')}
                        variant="outline"
                        fullWidth={false}
                        style={styles.formButton}
                        onPress={() => {
                          setShowSessionForm(false);
                          setErrorMessage('');
                        }}
                      />
                      <AppButton
                        title={t('academy.scheduleAction')}
                        loading={isCreating}
                        disabled={!sessionTitle.trim() || !sessionDate || !sessionTime}
                        fullWidth={false}
                        style={styles.formButton}
                        onPress={handleCreateSession}
                      />
                    </View>
                  </View>
                ) : (
                  <AnimatedPressable
                    style={styles.createButton}
                    hoverScale={1.02}
                    onPress={() => setShowSessionForm(true)}
                  >
                    <Ionicons name="add" size={18} color={colors.blackText} />
                    <Text style={styles.createButtonText}>
                      {sessionKind === 'match'
                        ? t('academy.newMatchTitle')
                        : t('academy.newTrainingTitle')}
                    </Text>
                  </AnimatedPressable>
                )}

                {sessions.length === 0 ? (
                  <EmptyBox
                    styles={styles}
                    colors={colors}
                    icon={sessionKind === 'match' ? 'trophy-outline' : 'time-outline'}
                  >
                    {sessionKind === 'match'
                      ? t('academy.noMatches')
                      : t('academy.noTrainings')}
                  </EmptyBox>
                ) : (
                  sessions.map((session) => (
                    <SessionRowView
                      key={session.id}
                      styles={styles}
                      colors={colors}
                      session={session}
                      t={t}
                      onToggleCancel={async () => {
                        await cancelSession(session.id, !session.is_cancelled);
                        loadSessions();
                      }}
                      onDelete={async () => {
                        await deleteSession(session.id);
                        loadSessions();
                      }}
                    />
                  ))
                )}
              </>
            )
          ) : (
            // Messages needs its own schema, with the parent-oversight rules
            // we settled on. Honest placeholder rather than a mock.
            <EmptyBox styles={styles} colors={colors} icon="chatbubbles-outline">
              {t('academy.comingNext')}
            </EmptyBox>
          )}
        </AnimatedSwap>
      )}
    </Screen>
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
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.emptyBox}>
      {icon ? <Ionicons name={icon} size={26} color={colors.greyDark} /> : null}
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

function SessionRowView({
  styles,
  colors,
  session,
  t,
  onToggleCancel,
  onDelete,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  session: SessionRow;
  t: (key: string) => string;
  onToggleCancel: () => void;
  onDelete: () => void;
}) {
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);

  const when = `${start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} · ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString(
    [],
    { hour: '2-digit', minute: '2-digit' }
  )}`;

  return (
    <View style={[styles.memberRow, session.is_cancelled && styles.sessionCancelled]}>
      <View style={styles.memberAvatar}>
        <Ionicons
          name={session.kind === 'match' ? 'trophy-outline' : 'time-outline'}
          size={18}
          color={session.is_cancelled ? colors.greyDark : colors.greenLight}
        />
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {session.title}
          {session.opponent ? ` · ${session.opponent}` : ''}
        </Text>
        <Text style={styles.memberMeta}>
          {[
            when,
            session.location_name,
            session.recurrence_group_id ? t('academy.repeats') : null,
            session.is_cancelled ? t('academy.cancelled') : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </View>

      <AnimatedPressable style={styles.rejectButton} onPress={onToggleCancel}>
        <Ionicons
          name={session.is_cancelled ? 'refresh' : 'close'}
          size={16}
          color={colors.grey}
        />
      </AnimatedPressable>

      <AnimatedPressable style={styles.rejectButton} onPress={onDelete}>
        <Ionicons name="trash-outline" size={15} color={colors.grey} />
      </AnimatedPressable>
    </View>
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
  const isPlayer = enrolment.member?.member_kind === 'player';

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberAvatar}>
        <Ionicons
          name={isPlayer ? 'football-outline' : 'person'}
          size={18}
          color={isPlayer ? colors.blueLight : colors.greyDark}
        />
      </View>

      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{enrolment.member?.full_name ?? '—'}</Text>
        <Text style={styles.memberMeta}>
          {[
            isPlayer ? t('academy.playerLabel') : t('academy.guardianLabel'),
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
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingBottom: spacing.sm,
      paddingRight: spacing.sm,
    },
    academyChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
      maxWidth: 220,
    },
    subTabChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
    },
    chipText: {
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
    inputRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    inputHalf: {
      flex: 1,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    toggleText: {
      color: colors.greySoft,
      fontSize: scaleFont(13),
      fontWeight: '700',
    },
    sessionCancelled: {
      opacity: 0.55,
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
