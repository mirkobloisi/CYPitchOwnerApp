import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import CalendarModal from '../../components/CalendarModal';
import OptionsModal, { PickerOption } from '../../components/OptionsModal';
import MemberGrid, { GridMember } from '../../components/MemberGrid';
import PlaceSearchModal from '../../components/PlaceSearchModal';
import Screen from '../../components/Screen';
import { useTranslation } from '../../i18n/LanguageContext';
import {
  Conversation,
  collapseToOnePerConversation,
  createGroupChat,
  ensureStaffMember,
  fetchConversations,
} from '../../lib/academyChat';
import { NoticeArea } from '../../lib/academyNotices';
import { signedMemberAvatars } from '../../lib/avatarUpload';
import { Place, mapsUrlFor } from '../../lib/placeSearch';
import { useAcademyRealtime } from '../../lib/academyRealtime';
import { useAuth } from '../../lib/auth';
import {
  AcademyCounts,
  AcademyRow,
  EnrolmentRow,
  OwnerPitch,
  SessionKind,
  SessionRow,
  ageFromDateOfBirth,
  cancelSession,
  createAcademy,
  createSession,
  deleteSession,
  fetchAcademyCounts,
  fetchEnrolments,
  fetchMyAcademies,
  fetchMyPitches,
  fetchSessions,
  respondToEnrolment,
  updateSession,
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
  const router = useRouter();
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
  const [pitches, setPitches] = useState<OwnerPitch[]>([]);
  const [academyCounts, setAcademyCounts] = useState<Record<string, AcademyCounts>>({});
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  // 60 minutes covers most academy trainings; the rest are a tap away.
  const [sessionDuration, setSessionDuration] = useState(60);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionPitchId, setSessionPitchId] = useState<string | null>(null);
  const [sessionOpponent, setSessionOpponent] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatForever, setRepeatForever] = useState(true);
  const [repeatUntil, setRepeatUntil] = useState('');

  // Which picker is open, if any.
  const { unread, markRead, enrolmentsVersion, messagesVersion } = useAcademyRealtime();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string | null>>({});
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [picker, setPicker] = useState<'date' | 'time' | 'duration' | 'pitch' | 'until' | null>(
    null
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    const rows = await fetchMyAcademies();
    setAcademies(rows);
    fetchAcademyCounts(rows.map((row) => row.id)).then(setAcademyCounts);

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

  const loadConversations = useCallback(async () => {
    if (selectedId) setStaffId(await ensureStaffMember(selectedId));
    setConversations(collapseToOnePerConversation(await fetchConversations()));
  }, [selectedId]);

  useEffect(() => {
    if (subTab === 'messages') loadConversations();
  }, [subTab, loadConversations, messagesVersion]);

  // Opening a tab is what marks its notices read, so the bell clears as
  // soon as the owner looks at what it was pointing to.
  useEffect(() => {
    if (subTab === 'players' || subTab === 'parents' || subTab === 'messages') {
      markRead(subTab as NoticeArea);
    }
  }, [subTab, markRead]);

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

  // A family requesting to join should show up without the owner reloading.
  useEffect(() => {
    if (selectedId) fetchEnrolments(selectedId).then(setEnrolments);
  }, [selectedId, enrolmentsVersion]);

  useEffect(() => {
    if (pitchOwner?.id) fetchMyPitches(pitchOwner.id).then(setPitches);
  }, [pitchOwner?.id]);

  const selectedPitch = pitches.find((pitch) => pitch.id === sessionPitchId) ?? null;

  /** Set when the venue came from the map rather than the owner's own list. */
  const [awayPlace, setAwayPlace] = useState<{ name: string; mapsUrl: string } | null>(null);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);

  const venueName = selectedPitch?.name ?? awayPlace?.name ?? null;
  const venueMapsUrl = selectedPitch?.maps_url ?? awayPlace?.mapsUrl ?? null;

  function resetSessionForm() {
    setEditingSessionId(null);
    setSessionTitle('');
    setSessionDate('');
    setSessionTime('');
    setSessionDuration(60);
    setSessionPitchId(null);
    setAwayPlace(null);
    setSessionOpponent('');
    setRepeatWeekly(false);
    setRepeatForever(true);
    setRepeatUntil('');
    setErrorMessage('');
  }

  /** Loads an existing session into the same form used to create one. */
  function openSessionForEdit(session: SessionRow) {
    const start = new Date(session.starts_at);
    const end = new Date(session.ends_at);

    setEditingSessionId(session.id);
    setSessionTitle(session.title);
    setSessionDate(
      `${start.getFullYear()}-${`${start.getMonth() + 1}`.padStart(2, '0')}-${`${start.getDate()}`.padStart(2, '0')}`
    );
    setSessionTime(
      `${`${start.getHours()}`.padStart(2, '0')}:${`${start.getMinutes()}`.padStart(2, '0')}`
    );
    setSessionDuration(Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000)));
    setSessionPitchId(session.pitch_id);
    setAwayPlace(
      !session.pitch_id && session.location_name
        ? { name: session.location_name, mapsUrl: session.maps_url ?? '' }
        : null
    );
    setSessionOpponent(session.opponent ?? '');
    setRepeatWeekly(session.recurrence === 'weekly');
    setRepeatForever(session.recurrence === 'weekly' && !session.recurrence_until);
    setRepeatUntil(session.recurrence_until ?? '');
    setErrorMessage('');
    setShowSessionForm(true);
  }

  async function handleCreateSession() {
    if (!selectedId || isCreating) return;

    const startsAt = new Date(`${sessionDate}T${sessionTime}`);
    if (Number.isNaN(startsAt.getTime())) {
      setErrorMessage(t('academy.invalidDateTime'));
      return;
    }

    if (repeatWeekly && !repeatForever && !repeatUntil) {
      setErrorMessage(t('academy.repeatNeedsEnd'));
      return;
    }

    const endsAt = new Date(startsAt.getTime() + sessionDuration * 60000);

    setIsCreating(true);
    setErrorMessage('');

    const payload = {
      title: sessionTitle,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      pitchId: sessionPitchId,
      // Either the owner's own pitch, which carries its own Maps link, or a
      // place picked off the map, which carries the one built from its
      // coordinates. Both reach parents and children the same way.
      locationName: venueName,
      mapsUrl: venueMapsUrl,
      opponent: sessionKind === 'match' ? sessionOpponent : null,
      recurrence: (repeatWeekly ? 'weekly' : 'none') as 'weekly' | 'none',
      recurrenceUntil: repeatWeekly && !repeatForever ? repeatUntil : null,
    };

    const { error } = editingSessionId
      ? await updateSession(editingSessionId, payload)
      : await createSession({ academyId: selectedId, kind: sessionKind, ...payload });

    setIsCreating(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    resetSessionForm();
    setShowSessionForm(false);
    loadSessions();
  }

  const timeOptions: PickerOption[] = useMemo(() => {
    const options: PickerOption[] = [];
    for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 15) {
      const label = `${`${Math.floor(minutes / 60)}`.padStart(2, '0')}:${`${minutes % 60}`.padStart(2, '0')}`;
      options.push({ value: label, label });
    }
    return options;
  }, []);

  const durationOptions: PickerOption[] = useMemo(
    () =>
      [45, 60, 75, 90, 105, 120, 150].map((minutes) => ({
        value: String(minutes),
        label: t('academy.durationValue').replace('{minutes}', String(minutes)),
      })),
    [t]
  );

  const pitchOptions: PickerOption[] = useMemo(
    () =>
      pitches.map((pitch) => ({
        value: pitch.id,
        label: pitch.name,
        hint: [pitch.area, pitch.city].filter(Boolean).join(', ') || null,
      })),
    [pitches]
  );

  function formatIsoDate(iso: string) {
    if (!iso) return '';
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

  /**
   * Member photos sit in a private bucket — they are pictures of children —
   * so each needs a short-lived signed URL. Storage RLS already lets this
   * owner read the photos of everyone enrolled with them.
   */
  useEffect(() => {
    let cancelled = false;

    const people = enrolments
      .map((row) => row.member)
      .filter((member): member is NonNullable<typeof member> => member != null);

    signedMemberAvatars(people).then((signed) => {
      if (!cancelled) setMemberAvatars(signed);
    });

    return () => {
      cancelled = true;
    };
  }, [enrolments]);

  /** An enrolment row as the compact grid wants it. */
  function toGridMember(row: EnrolmentRow): GridMember {
    const age = ageFromDateOfBirth(row.member?.date_of_birth ?? null);

    return {
      id: row.member?.id ?? row.id,
      full_name: row.member?.full_name ?? '—',
      avatar_url: row.member?.avatar_url ?? null,
      member_kind: row.member?.member_kind ?? 'player',
      meta: age != null ? t('academy.ageValue').replace('{age}', String(age)) : null,
    };
  }

  /**
   * A group straight from the roster, so the owner does not have to tick
   * forty names to reach everybody.
   */
  async function createRosterGroup(who: 'parents' | 'players' | 'both') {
    if (!selectedId || isCreatingGroup) return;

    setIsCreatingGroup(true);
    setErrorMessage('');

    const staff = await ensureStaffMember(selectedId);
    const rows = who === 'parents' ? parents : who === 'players' ? players : approved;
    const ids = rows
      .map((row) => row.member?.id)
      .filter((id): id is string => typeof id === 'string');

    if (!staff || ids.length === 0) {
      setIsCreatingGroup(false);
      setErrorMessage(t('academyChat.nobody'));
      return;
    }

    const label = academies.find((item) => item.id === selectedId)?.name ?? '';
    const title = `${label} · ${t(`academy.group_${who}`)}`.trim();

    const { id, error } = await createGroupChat(staff, title, ids, true);
    setIsCreatingGroup(false);

    if (error || !id) {
      setErrorMessage(error ?? t('academyChat.couldNotStart'));
      return;
    }

    router.push({
      pathname: '/academy-chat',
      params: { conversationId: id, asMemberId: staff },
    } as any);
  }

  /** Notices only ever belong to these three tabs. */
  function unreadFor(key: SubTab) {
    if (key === 'players') return unread.players;
    if (key === 'parents') return unread.parents;
    if (key === 'messages') return unread.messages;
    return 0;
  }

  return (
    <Screen maxWidth={900}>
      <AppHeader title={t('academy.title')} subtitle={t('academy.subtitle')} showBack={false} />

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
              <View style={styles.chipInner}>
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

                {unreadFor(tab.key) > 0 ? (
                  <View style={styles.bell}>
                    <Ionicons name="notifications" size={9} color={colors.blackText} />
                    <Text style={styles.bellCount}>{unreadFor(tab.key)}</Text>
                  </View>
                ) : null}
              </View>
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
                // Every academy this centre runs. Tapping one opens its own
                // screen for settings, players, parents and schedule.
                academies.map((item) => {
                  const counts = academyCounts[item.id];

                  return (
                    <AnimatedPressable
                      key={item.id}
                      pressedScale={0.98}
                      hoverScale={1.01}
                      onPress={() => {
                        selectAcademy(item.id);
                        router.push({
                          pathname: '/academy-details',
                          params: { academyId: item.id },
                        } as any);
                      }}
                    >
                      <View style={styles.academyCard}>
                        {item.logo_url ? (
                          <Image
                            source={{ uri: item.logo_url }}
                            style={styles.academyLogo}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.academyLogo, styles.academyLogoPlaceholder]}>
                            <Ionicons name="school" size={22} color={colors.greenLight} />
                          </View>
                        )}

                        <View style={styles.academyCardInfo}>
                          <Text style={styles.academyCardName}>{item.name}</Text>
                          {item.city ? (
                            <Text style={styles.academyCardCity}>{item.city}</Text>
                          ) : null}

                          <View style={styles.academyCardStats}>
                            <Text style={styles.academyCardStat}>
                              {t('academy.playersCount').replace(
                                '{count}',
                                String(counts?.players ?? 0)
                              )}
                            </Text>
                            <Text style={styles.academyCardStat}>
                              {t('academy.parentsCount').replace(
                                '{count}',
                                String(counts?.parents ?? 0)
                              )}
                            </Text>
                            {counts?.pending ? (
                              <Text style={styles.academyCardPending}>
                                {t('academy.pendingCount').replace(
                                  '{count}',
                                  String(counts.pending)
                                )}
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={colors.greyDark} />
                      </View>
                    </AnimatedPressable>
                  );
                })
              )}
            </>
          ) : subTab === 'players' || subTab === 'parents' ? (
            <>
              {(() => {
                const isPlayers = subTab === 'players';
                const waiting = pending.filter((row) =>
                  isPlayers
                    ? row.member?.member_kind === 'player'
                    : row.member?.member_kind === 'guardian'
                );
                const roster = isPlayers ? players : parents;

                return (
                  <>
                    {waiting.length > 0 ? (
                      <>
                        <Text style={styles.sectionTitle}>
                          {t('academy.pendingTitle')} ({waiting.length})
                        </Text>
                        {waiting.map((enrolment) => (
                          <MemberRow
                            key={enrolment.id}
                            styles={styles}
                            colors={colors}
                            enrolment={enrolment}
                            avatarUrl={memberAvatars[enrolment.member?.id ?? ''] ?? null}
                            t={t}
                            onApprove={() => respond(enrolment.id, true)}
                            onReject={() => respond(enrolment.id, false)}
                          />
                        ))}
                      </>
                    ) : null}

                    <MemberGrid
                      members={roster.map(toGridMember)}
                      avatars={memberAvatars}
                      emptyText={
                        isPlayers ? t('academy.noPlayers') : t('academy.noParents')
                      }
                    />

                    {roster.length > 0 ? (
                      <AnimatedPressable
                        style={styles.groupButton}
                        hoverScale={1.02}
                        onPress={() => createRosterGroup(isPlayers ? 'players' : 'parents')}
                      >
                        {isCreatingGroup ? (
                          <ActivityIndicator color={colors.blackText} size="small" />
                        ) : (
                          <>
                            <Ionicons name="people" size={16} color={colors.blackText} />
                            <Text style={styles.groupButtonText}>
                              {isPlayers
                                ? t('academy.groupAllPlayers')
                                : t('academy.groupAllParents')}
                            </Text>
                          </>
                        )}
                      </AnimatedPressable>
                    ) : null}

                    {approved.length > 0 ? (
                      <AnimatedPressable
                        style={styles.groupButtonPlain}
                        hoverScale={1.02}
                        onPress={() => createRosterGroup('both')}
                      >
                        <Ionicons name="chatbubbles-outline" size={15} color={colors.greenLight} />
                        <Text style={styles.groupButtonPlainText}>
                          {t('academy.groupEveryone')}
                        </Text>
                      </AnimatedPressable>
                    ) : null}

                    {errorMessage ? (
                      <Text style={styles.errorText}>{errorMessage}</Text>
                    ) : null}
                  </>
                );
              })()}
            </>
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
                      {editingSessionId
                        ? t('academy.editSessionTitle')
                        : sessionKind === 'match'
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
                      <PickerField
                        styles={styles}
                        colors={colors}
                        icon="calendar-outline"
                        label={t('academy.dateLabel')}
                        value={formatIsoDate(sessionDate)}
                        style={styles.inputHalf}
                        onPress={() => setPicker('date')}
                      />
                      <PickerField
                        styles={styles}
                        colors={colors}
                        icon="time-outline"
                        label={t('academy.timeLabel')}
                        value={sessionTime}
                        style={styles.inputHalf}
                        onPress={() => setPicker('time')}
                      />
                    </View>

                    <PickerField
                      styles={styles}
                      colors={colors}
                      icon="hourglass-outline"
                      label={t('academy.durationLabel')}
                      value={t('academy.durationValue').replace('{minutes}', String(sessionDuration))}
                      onPress={() => setPicker('duration')}
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

                    <PickerField
                      styles={styles}
                      colors={colors}
                      icon="location-outline"
                      label={t('academy.pitchLabel')}
                      value={venueName ?? ''}
                      onPress={() => setPicker('pitch')}
                    />

                    {/* A match is often away, at a ground this owner does not
                        run, so anywhere on the map can be the venue. */}
                    <AnimatedPressable
                      style={styles.findPlaceRow}
                      onPress={() => setShowPlaceSearch(true)}
                    >
                      <Ionicons name="search" size={15} color={colors.greenLight} />
                      <Text style={styles.findPlaceText}>
                        {t('placeSearch.findElsewhere')}
                      </Text>
                    </AnimatedPressable>

                    {venueMapsUrl ? (
                      <View style={styles.mapsNote}>
                        <Ionicons name="map-outline" size={14} color={colors.blueLight} />
                        <Text style={styles.mapsNoteText}>
                          {awayPlace
                            ? t('placeSearch.savedPlace').replace('{name}', awayPlace.name)
                            : t('academy.mapsLinked')}
                        </Text>
                      </View>
                    ) : null}

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
                      <>
                        <AnimatedPressable
                          style={styles.toggleRow}
                          onPress={() => setRepeatForever((value) => !value)}
                        >
                          <Ionicons
                            name={repeatForever ? 'radio-button-on' : 'radio-button-off'}
                            size={19}
                            color={repeatForever ? colors.greenLight : colors.greyDark}
                          />
                          <Text style={styles.toggleText}>{t('academy.repeatForever')}</Text>
                        </AnimatedPressable>

                        {!repeatForever ? (
                          <PickerField
                            styles={styles}
                            colors={colors}
                            icon="calendar-outline"
                            label={t('academy.repeatUntilLabel')}
                            value={formatIsoDate(repeatUntil)}
                            onPress={() => setPicker('until')}
                          />
                        ) : null}
                      </>
                    ) : null}

                    {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                    <View style={styles.formActions}>
                      <AppButton
                        title={t('common.cancel')}
                        variant="outline"
                        fullWidth={false}
                        style={styles.formButton}
                        onPress={() => {
                          resetSessionForm();
                          setShowSessionForm(false);
                        }}
                      />
                      <AppButton
                        title={
                          editingSessionId ? t('common.save') : t('academy.scheduleAction')
                        }
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
                    onPress={() => {
                      resetSessionForm();
                      setShowSessionForm(true);
                    }}
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
                      onOpen={() => openSessionForEdit(session)}
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
            <>
              <AnimatedPressable
                style={styles.createButton}
                hoverScale={1.02}
                onPress={() =>
                  router.push({
                    pathname: '/academy-new-chat',
                    params: { academyId: selectedId ?? undefined },
                  } as any)
                }
              >
                <Ionicons name="create-outline" size={17} color={colors.blackText} />
                <Text style={styles.createButtonText}>{t('academyChat.newTitle')}</Text>
              </AnimatedPressable>

              {conversations.length === 0 ? (
                <EmptyBox styles={styles} colors={colors} icon="chatbubbles-outline">
                  {t('academyChat.noneYet')}
                </EmptyBox>
              ) : (
                conversations.map((row) => (
                  <AnimatedPressable
                    key={row.id}
                    pressedScale={0.98}
                    hoverScale={1.01}
                    onPress={() =>
                      router.push({
                        pathname: '/academy-chat',
                        params: { conversationId: row.id, asMemberId: row.for_member_id },
                      } as any)
                    }
                  >
                    <View style={styles.memberRow}>
                      <View>
                        {row.kind === 'group' && row.image_url ? (
                          <Image
                            source={{ uri: row.image_url }}
                            style={styles.memberAvatar}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.memberAvatar}>
                            <Ionicons
                              name={row.kind === 'group' ? 'people' : 'chatbubble-ellipses'}
                              size={17}
                              color={colors.greenLight}
                            />
                          </View>
                        )}

                        {row.kind === 'group' ? (
                          <View style={styles.groupBadge}>
                            <Ionicons name="people" size={9} color={colors.blackText} />
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {row.kind === 'group'
                            ? row.title || t('academyChat.untitledGroup')
                            : row.other_names.join(', ') || t('academyChat.unknownPerson')}
                        </Text>
                        <Text style={styles.memberMeta} numberOfLines={1}>
                          {row.last_body || t('academyChat.noMessagesYet')}
                        </Text>
                      </View>

                      {row.unread_count > 0 ? (
                        <View style={styles.unreadDot}>
                          <Text style={styles.unreadText}>{row.unread_count}</Text>
                        </View>
                      ) : null}

                      {row.kind === 'group' ? (
                        <AnimatedPressable
                          style={styles.groupSettings}
                          onPress={() =>
                            router.push({
                              pathname: '/academy-group',
                              params: {
                                conversationId: row.id,
                                asMemberId: row.for_member_id,
                              },
                            } as any)
                          }
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={15}
                            color={colors.greyDark}
                          />
                        </AnimatedPressable>
                      ) : null}
                    </View>
                  </AnimatedPressable>
                ))
              )}
            </>
          )}
        </AnimatedSwap>
      )}

      <CalendarModal
        visible={picker === 'date'}
        value={sessionDate}
        title={t('academy.dateLabel')}
        minDate={new Date()}
        onSelect={setSessionDate}
        onClose={() => setPicker(null)}
      />

      <CalendarModal
        visible={picker === 'until'}
        value={repeatUntil}
        title={t('academy.repeatUntilLabel')}
        minDate={sessionDate ? new Date(`${sessionDate}T00:00:00`) : new Date()}
        onSelect={setRepeatUntil}
        onClose={() => setPicker(null)}
      />

      <OptionsModal
        visible={picker === 'time'}
        title={t('academy.timeLabel')}
        options={timeOptions}
        value={sessionTime || null}
        onSelect={setSessionTime}
        onClose={() => setPicker(null)}
      />

      <OptionsModal
        visible={picker === 'duration'}
        title={t('academy.durationLabel')}
        options={durationOptions}
        value={String(sessionDuration)}
        onSelect={(next) => setSessionDuration(Number(next))}
        onClose={() => setPicker(null)}
      />

      <OptionsModal
        visible={picker === 'pitch'}
        title={t('academy.pitchLabel')}
        options={pitchOptions}
        value={sessionPitchId}
        emptyText={t('academy.noPitches')}
        onSelect={(value) => {
          // One venue at a time: choosing an own pitch drops the map place.
          setSessionPitchId(value);
          setAwayPlace(null);
        }}
        onClose={() => setPicker(null)}
      />

      <PlaceSearchModal
        visible={showPlaceSearch}
        onSelect={(place: Place) => {
          setAwayPlace({ name: place.name, mapsUrl: mapsUrlFor(place) });
          setSessionPitchId(null);
        }}
        onClose={() => setShowPlaceSearch(false)}
      />
    </Screen>
  );
}

/** A read-only field that opens a picker instead of a keyboard. */
function PickerField({
  styles,
  colors,
  icon,
  label,
  value,
  style,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  style?: object;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable style={[styles.pickerField, style]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.greyDark} />

      <View style={styles.pickerTextWrap}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <Text style={[styles.pickerValue, !value && styles.pickerValueEmpty]} numberOfLines={1}>
          {value || '—'}
        </Text>
      </View>

      <Ionicons name="chevron-down" size={15} color={colors.greyDark} />
    </AnimatedPressable>
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
  onOpen,
  onToggleCancel,
  onDelete,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  session: SessionRow;
  t: (key: string) => string;
  onOpen: () => void;
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

      {/* The row opens the session for editing; the two buttons at the end
          keep their own actions. */}
      <AnimatedPressable style={styles.memberInfo} onPress={onOpen}>
        <Text style={styles.memberName}>
          {session.title}
          {session.opponent ? ` · ${session.opponent}` : ''}
        </Text>
        <Text style={styles.memberMeta}>
          {[
            when,
            session.location_name,
            session.recurrence === 'weekly'
              ? session.recurrence_until
                ? t('academy.repeatsUntil').replace(
                    '{date}',
                    new Date(`${session.recurrence_until}T00:00:00`).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })
                  )
                : t('academy.repeatsForever')
              : null,
            session.is_cancelled ? t('academy.cancelled') : null,
          ]
            .filter(Boolean)
            .join(' • ')}
        </Text>
      </AnimatedPressable>

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
  avatarUrl,
  t,
  onApprove,
  onReject,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: AppColors;
  enrolment: EnrolmentRow;
  avatarUrl?: string | null;
  t: (key: string) => string;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const age = ageFromDateOfBirth(enrolment.member?.date_of_birth ?? null);
  const isPlayer = enrolment.member?.member_kind === 'player';

  return (
    <View style={styles.memberRow}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.memberAvatar} resizeMode="cover" />
      ) : (
        <View style={styles.memberAvatar}>
          <Ionicons
            name={isPlayer ? 'football-outline' : 'person'}
            size={18}
            color={isPlayer ? colors.blueLight : colors.greyDark}
          />
        </View>
      )}

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
    chipInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    // A bell rather than a plain dot: it says what kind of thing is waiting,
    // not merely that something is.
    bell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 5,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.greenLight,
    },
    bellCount: {
      color: colors.blackText,
      fontSize: 9,
      fontWeight: '900',
    },
    groupBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
      borderWidth: 2,
      borderColor: colors.card,
    },
    groupSettings: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    unreadDot: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
    },
    unreadText: {
      color: colors.blackText,
      fontSize: 11,
      fontWeight: '900',
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
    academyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: 10,
    },
    academyLogo: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
    },
    academyLogoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenSoft,
    },
    academyCardInfo: {
      flex: 1,
      minWidth: 0,
    },
    academyCardName: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '800',
    },
    academyCardCity: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginTop: 2,
    },
    academyCardStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: 6,
    },
    academyCardStat: {
      color: colors.greyDark,
      fontSize: scaleFont(11),
      fontWeight: '800',
    },
    academyCardPending: {
      color: colors.orange,
      fontSize: scaleFont(11),
      fontWeight: '800',
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
    pickerField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
      marginBottom: spacing.sm,
    },
    pickerTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    pickerLabel: {
      color: colors.greyDark,
      fontSize: scaleFont(10),
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    pickerValue: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '700',
      marginTop: 1,
    },
    pickerValueEmpty: {
      color: colors.greyDark,
    },
    findPlaceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 11,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      backgroundColor: colors.greenSoft,
      marginBottom: spacing.sm,
    },
    findPlaceText: {
      color: colors.greenLight,
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
    mapsNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.sm,
    },
    mapsNoteText: {
      color: colors.blueLight,
      fontSize: scaleFont(12),
      fontWeight: '700',
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
    groupButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.greenLight,
      borderRadius: radius.lg,
      paddingVertical: 12,
      marginBottom: 8,
    },
    groupButtonText: {
      color: colors.blackText,
      fontSize: scaleFont(13),
      fontWeight: '900',
    },
    groupButtonPlain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      backgroundColor: colors.greenSoft,
      paddingVertical: 11,
      marginBottom: 8,
    },
    groupButtonPlainText: {
      color: colors.greenLight,
      fontSize: scaleFont(13),
      fontWeight: '800',
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
