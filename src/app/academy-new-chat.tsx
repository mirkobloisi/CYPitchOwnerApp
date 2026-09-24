import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AnimatedSelectable from '../components/AnimatedSelectable';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import Screen from '../components/Screen';
import { useTranslation } from '../i18n/LanguageContext';
import {
  ChatPerson,
  createGroupChat,
  ensureStaffMember,
  fetchAcademyPeople,
  startDirectChat,
} from '../lib/academyChat';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

type Mode = 'direct' | 'group';
type Filter = 'all' | 'parents' | 'players';

export default function AcademyNewChatScreen() {
  const { academyId } = useLocalSearchParams<{ academyId: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('direct');
  const [filter, setFilter] = useState<Filter>('all');
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    // The owner needs their staff member row before they can be in a thread.
    if (academyId) setStaffId(await ensureStaffMember(academyId));
    setPeople(await fetchAcademyPeople());
    setIsLoading(false);
  }, [academyId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(memberId: string) {
    if (mode === 'direct') {
      openDirect(memberId);
      return;
    }

    setPicked((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  }

  async function openDirect(memberId: string) {
    if (!staffId || isBusy) return;

    setIsBusy(true);
    setErrorMessage('');

    const { id, error } = await startDirectChat(staffId, memberId);
    setIsBusy(false);

    if (error || !id) {
      setErrorMessage(error ?? t('academyChat.couldNotStart'));
      return;
    }

    router.replace({
      pathname: '/academy-chat',
      params: { conversationId: id, asMemberId: staffId },
    } as any);
  }

  async function createGroup() {
    if (!staffId || picked.length === 0 || isBusy) return;

    setIsBusy(true);
    setErrorMessage('');

    const { id, error } = await createGroupChat(staffId, title, picked);
    setIsBusy(false);

    if (error || !id) {
      setErrorMessage(error ?? t('academyChat.couldNotStart'));
      return;
    }

    router.replace({
      pathname: '/academy-chat',
      params: { conversationId: id, asMemberId: staffId },
    } as any);
  }

  const shown = people.filter((person) =>
    filter === 'all'
      ? true
      : filter === 'parents'
        ? person.member_kind === 'guardian'
        : person.member_kind === 'player'
  );

  return (
    <Screen maxWidth={900}>
      <AppHeader title={t('academyChat.newTitle')} />

      <View style={styles.chipRow}>
        {(['direct', 'group'] as Mode[]).map((key) => (
          <AnimatedSelectable
            key={key}
            active={mode === key}
            style={styles.chip}
            background={[colors.card, colors.greenSoft]}
            borderColor={[colors.border, colors.borderGreen]}
            onPress={() => {
              setMode(key);
              setPicked([]);
            }}
          >
            <Text style={[styles.chipText, mode === key && styles.chipTextActive]}>
              {key === 'direct' ? t('academyChat.modeDirect') : t('academyChat.modeGroup')}
            </Text>
          </AnimatedSelectable>
        ))}
      </View>

      {mode === 'group' ? (
        <>
          {/* The owner names the group, so a family knows what it is before
              they open it. */}
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('academyChat.groupNamePlaceholder')}
            placeholderTextColor={colors.greyDark}
          />
          <Text style={styles.hint}>{t('academyChat.groupHint')}</Text>
        </>
      ) : (
        <Text style={styles.hint}>{t('academyChat.directHint')}</Text>
      )}

      <View style={styles.chipRow}>
        {(['all', 'parents', 'players'] as Filter[]).map((key) => (
          <AnimatedSelectable
            key={key}
            active={filter === key}
            style={styles.chip}
            background={[colors.card, colors.blueSoft]}
            borderColor={[colors.border, colors.borderBlue]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.chipText, filter === key && styles.chipTextBlue]}>
              {t(`academyChat.filter_${key}`)}
            </Text>
          </AnimatedSelectable>
        ))}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : shown.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={26} color={colors.greyDark} />
          <Text style={styles.emptyText}>{t('academyChat.nobody')}</Text>
        </View>
      ) : (
        shown.map((person) => {
          const isPicked = picked.includes(person.id);
          const isPlayer = person.member_kind === 'player';

          return (
            <AnimatedPressable key={person.id} pressedScale={0.98} onPress={() => toggle(person.id)}>
              <View style={[styles.row, isPicked && styles.rowPicked]}>
                <View style={styles.rowIcon}>
                  <Ionicons
                    name={isPlayer ? 'football-outline' : 'person'}
                    size={17}
                    color={isPlayer ? colors.blueLight : colors.greyDark}
                  />
                </View>

                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{person.full_name}</Text>
                  <Text style={styles.rowMeta}>
                    {[
                      isPlayer ? t('academy.playerLabel') : t('academy.guardianLabel'),
                      person.academy_name,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>

                <Ionicons
                  name={
                    mode === 'group'
                      ? isPicked
                        ? 'checkmark-circle'
                        : 'ellipse-outline'
                      : 'chevron-forward'
                  }
                  size={mode === 'group' ? 22 : 16}
                  color={isPicked ? colors.greenLight : colors.greyDark}
                />
              </View>
            </AnimatedPressable>
          );
        })
      )}

      {mode === 'group' ? (
        <AppButton
          title={t('academyChat.createGroup')}
          loading={isBusy}
          disabled={picked.length === 0}
          style={styles.createButton}
          onPress={createGroup}
        />
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.round,
      borderWidth: 1,
    },
    chipText: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    chipTextActive: {
      color: colors.greenLight,
    },
    chipTextBlue: {
      color: colors.blueLight,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    hint: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      lineHeight: 17,
      marginBottom: spacing.md,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    loading: {
      marginTop: spacing.lg,
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
    rowPicked: {
      borderColor: colors.borderGreen,
      backgroundColor: colors.greenSoft,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
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
    createButton: {
      marginTop: spacing.sm,
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
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
