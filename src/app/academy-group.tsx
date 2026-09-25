import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AppButton from '../components/AppButton';
import AppHeader from '../components/AppHeader';
import AvatarCropModal from '../components/AvatarCropModal';
import AvatarPickerTrigger from '../components/AvatarPickerTrigger';
import Screen from '../components/Screen';
import { useTranslation } from '../i18n/LanguageContext';
import {
  Conversation,
  deleteGroup,
  fetchConversations,
  fetchGroupMembers,
  transferGroupLeadership,
  updateGroup,
} from '../lib/academyChat';
import { PickedAvatarImage, cropAndUploadGroupImage } from '../lib/avatarUpload';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export default function AcademyGroupScreen() {
  const { conversationId, asMemberId } = useLocalSearchParams<{
    conversationId: string;
    asMemberId: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [group, setGroup] = useState<Conversation | null>(null);
  const [people, setPeople] = useState<{ id: string; full_name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<PickedAvatarImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    if (!conversationId) return;

    const rows = await fetchConversations();
    const found = rows.find((row) => row.id === conversationId) ?? null;

    setGroup(found);
    setTitle(found?.title ?? '');
    setPeople(await fetchGroupMembers(conversationId));
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Only the member who leads it may rename it or change its picture. */
  const iLead = group?.created_by != null && group.created_by === asMemberId;

  async function handleCropped(crop: { originX: number; originY: number; size: number }) {
    if (!picked || !conversationId) return;

    setIsBusy(true);
    setErrorMessage('');

    try {
      const url = await cropAndUploadGroupImage(conversationId, picked, crop);
      const { error } = await updateGroup({ conversationId, imageUrl: url });

      if (error) setErrorMessage(error);
      else setSavedMessage(t('academy.saved'));

      setPicked(null);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('academyChat.couldNotStart'));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRename() {
    if (!conversationId || isBusy) return;

    setIsBusy(true);
    setErrorMessage('');

    const { error } = await updateGroup({ conversationId, title });
    setIsBusy(false);

    if (error) setErrorMessage(error);
    else {
      setSavedMessage(t('academy.saved'));
      load();
    }
  }

  async function handOver(memberId: string) {
    if (!conversationId || isBusy) return;

    setIsBusy(true);
    setErrorMessage('');

    const { error } = await transferGroupLeadership(conversationId, memberId);
    setIsBusy(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setHandingOver(false);
    load();
  }

  async function handleDelete() {
    if (!conversationId || isBusy) return;

    setIsBusy(true);
    setErrorMessage('');

    const { error } = await deleteGroup(conversationId);
    setIsBusy(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    router.back();
  }

  if (isLoading) {
    return (
      <Screen scroll={false} maxWidth={900}>
        <AppHeader title={t('academyChat.groupTitle')} />
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen maxWidth={900}>
        <AppHeader title={t('academyChat.groupTitle')} />
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('academyChat.groupGone')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen maxWidth={900}>
      <AppHeader title={group.title || t('academyChat.untitledGroup')} />

      <View style={styles.imageRow}>
        <AvatarPickerTrigger
          disabled={!iLead || isBusy}
          onPicked={setPicked}
          onError={(error) =>
            setErrorMessage(
              error instanceof Error ? error.message : t('academyChat.couldNotStart')
            )
          }
        >
          <View style={styles.imageWrap}>
            {group.image_url ? (
              <Image source={{ uri: group.image_url }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.imagePlaceholder]}>
                <Ionicons name="people" size={30} color={colors.greenLight} />
              </View>
            )}

            {/* Only the leader gets the camera badge, because only they can
                change it. */}
            {iLead ? (
              <View style={styles.imageBadge}>
                {isBusy ? (
                  <ActivityIndicator color={colors.blackText} size="small" />
                ) : (
                  <Ionicons name="camera" size={13} color={colors.blackText} />
                )}
              </View>
            ) : null}
          </View>
        </AvatarPickerTrigger>

        <Text style={styles.imageHint}>
          {iLead ? t('academyChat.groupImageHint') : t('academyChat.groupLedByOther')}
        </Text>
      </View>

      {iLead ? (
        <>
          <Text style={styles.label}>{t('academyChat.groupNameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={t('academyChat.groupNamePlaceholder')}
            placeholderTextColor={colors.greyDark}
          />

          {savedMessage ? <Text style={styles.savedText}>{savedMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <AppButton title={t('common.save')} loading={isBusy} onPress={handleRename} />
        </>
      ) : errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <Text style={styles.heading}>{t('academyChat.groupPeople')}</Text>

      {people.map((person) => (
        <View key={person.id} style={styles.personRow}>
          <View style={styles.personIcon}>
            <Ionicons name="person" size={16} color={colors.greyDark} />
          </View>

          <Text style={styles.personName}>{person.full_name}</Text>

          {person.id === group.created_by ? (
            <Text style={styles.leaderTag}>{t('academyChat.groupLeader')}</Text>
          ) : handingOver && iLead ? (
            <AnimatedPressable style={styles.handButton} onPress={() => handOver(person.id)}>
              <Text style={styles.handButtonText}>{t('academyChat.groupHandOver')}</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      ))}

      {iLead ? (
        <>
          {/* A leader cannot simply walk out: they hand the group on, or take
              it with them. */}
          {people.length > 1 ? (
            <AnimatedPressable
              style={styles.action}
              onPress={() => setHandingOver((value) => !value)}
            >
              <Ionicons name="swap-horizontal" size={16} color={colors.greenLight} />
              <Text style={styles.actionText}>
                {handingOver ? t('common.cancel') : t('academyChat.groupHandOverTitle')}
              </Text>
            </AnimatedPressable>
          ) : null}

          {confirmDelete ? (
            <View style={styles.dangerCard}>
              <Text style={styles.dangerText}>{t('academyChat.groupDeleteWarning')}</Text>

              <View style={styles.dangerActions}>
                <AppButton
                  title={t('common.cancel')}
                  variant="outline"
                  fullWidth={false}
                  style={styles.dangerButton}
                  onPress={() => setConfirmDelete(false)}
                />
                <AnimatedPressable style={styles.deleteButton} onPress={handleDelete}>
                  {isBusy ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.deleteButtonText}>{t('academyChat.groupDelete')}</Text>
                  )}
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <AnimatedPressable style={styles.deleteLink} onPress={() => setConfirmDelete(true)}>
              <Ionicons name="trash-outline" size={15} color={colors.red} />
              <Text style={styles.deleteLinkText}>{t('academyChat.groupDelete')}</Text>
            </AnimatedPressable>
          )}
        </>
      ) : null}

      <AvatarCropModal
        visible={!!picked}
        imageUri={picked?.uri ?? null}
        imageWidth={picked?.width ?? 0}
        imageHeight={picked?.height ?? 0}
        onCancel={() => setPicked(null)}
        onConfirm={handleCropped}
      />
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    loading: {
      marginTop: spacing.xl,
    },
    imageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    imageWrap: {
      width: 76,
      height: 76,
    },
    image: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.greenSoft,
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
      borderWidth: 2,
      borderColor: colors.background,
    },
    imageHint: {
      flex: 1,
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      lineHeight: 17,
    },
    label: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
      marginBottom: 6,
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
    savedText: {
      color: colors.greenLight,
      fontSize: scaleFont(12),
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: spacing.sm,
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
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.sm,
      marginBottom: 8,
    },
    personIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    personName: {
      flex: 1,
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '700',
    },
    leaderTag: {
      color: colors.greenLight,
      fontSize: scaleFont(11),
      fontWeight: '900',
    },
    handButton: {
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      borderRadius: radius.round,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    handButtonText: {
      color: colors.greenLight,
      fontSize: scaleFont(11),
      fontWeight: '800',
    },
    action: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      backgroundColor: colors.greenSoft,
      marginTop: spacing.sm,
    },
    actionText: {
      color: colors.greenLight,
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
    deleteLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    deleteLinkText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '800',
    },
    dangerCard: {
      marginTop: spacing.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    dangerText: {
      color: colors.greySoft,
      fontSize: scaleFont(12),
      fontWeight: '600',
      lineHeight: 18,
      marginBottom: spacing.sm,
    },
    dangerActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dangerButton: {
      flex: 1,
    },
    deleteButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.red,
      borderRadius: radius.lg,
      paddingVertical: 13,
    },
    deleteButtonText: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '900',
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      textAlign: 'center',
    },
  });
