import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import AppButton from '../../components/AppButton';
import Screen from '../../components/Screen';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont, scaleLine } from '../../theme/typography';

const SUPPORT_EMAIL = 'mypitch_help@proton.me';

export default function PendingScreen() {
  const { colors } = useAppTheme();
  const { profile, pitchOwner, signOut } = useAuth();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { title, message, icon, tone } = getStatusContent(profile?.role, pitchOwner?.status, t);

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={[styles.iconCircle, tone === 'red' && styles.iconCircleRed]}>
        <Ionicons
          name={icon}
          size={36}
          color={tone === 'red' ? colors.red : colors.yellow}
        />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.actions}>
        <AppButton
          title={t('pending.contactSupport')}
          variant="outline"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <View style={styles.buttonSpacing}>
          <AppButton title={t('pending.logOut')} variant="ghost" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}

function getStatusContent(
  role: string | undefined,
  status: string | undefined,
  t: (path: string) => string
) {
  if (role !== 'pitch_owner') {
    return {
      title: t('pending.notOwnerTitle'),
      message: t('pending.notOwnerMessage'),
      icon: 'alert-circle-outline' as const,
      tone: 'red' as const,
    };
  }

  if (status === 'suspended') {
    return {
      title: t('pending.suspendedTitle'),
      message: t('pending.suspendedMessage'),
      icon: 'ban-outline' as const,
      tone: 'red' as const,
    };
  }

  // 'rejected' is an application that was turned down at signup, as opposed to
  // 'suspended', which is an owner who had access and lost it. They read very
  // differently to the person on the other end, so they get separate copy.
  if (status === 'rejected') {
    return {
      title: t('pending.rejectedTitle'),
      message: t('pending.rejectedMessage'),
      icon: 'close-circle-outline' as const,
      tone: 'red' as const,
    };
  }

  return {
    title: t('pending.pendingTitle'),
    message: t('pending.pendingMessage'),
    icon: 'time-outline' as const,
    tone: 'yellow' as const,
  };
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    screenContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 84,
      height: 84,
      borderRadius: radius.round,
      backgroundColor: colors.yellowSoft,
      borderWidth: 1,
      borderColor: 'rgba(255, 212, 59, 0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    iconCircleRed: {
      backgroundColor: colors.redSoft,
      borderColor: 'rgba(255, 69, 58, 0.35)',
    },
    title: {
      color: colors.white,
      fontSize: scaleFont(22),
      fontWeight: '900',
      textAlign: 'center',
    },
    message: {
      color: colors.grey,
      fontSize: scaleFont(14),
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: scaleLine(20),
      marginTop: spacing.sm,
      maxWidth: 320,
    },
    actions: {
      width: '100%',
      marginTop: spacing.xxl,
    },
    buttonSpacing: {
      marginTop: spacing.md,
    },
  });
