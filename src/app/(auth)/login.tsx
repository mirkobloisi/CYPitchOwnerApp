import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../../components/AppButton';
import Screen from '../../components/Screen';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import { getRememberMe, setRememberMe } from '../../lib/rememberMe';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont, scaleLine } from '../../theme/typography';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(getRememberMe());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const passwordRef = useRef<TextInput>(null);

  // Only the website has a session that can outlive the app being closed; on
  // a phone the session always persists, so the choice would mean nothing.
  const isWeb = Platform.OS === 'web';

  async function handleLogin() {
    if (!email.trim() || !password) {
      setErrorMessage(t('login.errorEnterCredentials'));
      return;
    }

    // Recorded before signing in, so the session Supabase is about to write
    // goes straight into the right store.
    setRememberMe(remember);

    setIsSubmitting(true);
    setErrorMessage('');

    const { error } = await signIn(email.trim(), password);

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    }
  }

  return (
    <Screen scroll={false} contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Ionicons name="football" size={30} color={colors.greenLight} />
        </View>
        <Text style={styles.brand}>{t('login.brand')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>{t('login.emailLabel')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('login.emailPlaceholder')}
          placeholderTextColor={colors.greyDark}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={styles.input}
        />

        <Text style={[styles.label, styles.labelSpaced]}>{t('login.passwordLabel')}</Text>
        <TextInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.greyDark}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
          style={styles.input}
        />

        {isWeb ? (
          <Pressable style={styles.rememberRow} onPress={() => setRemember((value) => !value)}>
            <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
              {remember ? <Ionicons name="checkmark" size={14} color={colors.blackText} /> : null}
            </View>
            <Text style={styles.rememberText}>{t('login.rememberMe')}</Text>
          </Pressable>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <View style={styles.buttonSpacing}>
          <AppButton title={t('login.loginButton')} onPress={handleLogin} loading={isSubmitting} />
        </View>
      </View>

      <AppButton
        title={t('login.requestAccess')}
        variant="ghost"
        style={styles.buttonSpacing}
        onPress={() => router.push('/signup')}
      />

      <Text style={styles.footerNote}>{t('login.footerNote')}</Text>
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    screenContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: radius.round,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    brand: {
      color: colors.white,
      fontSize: scaleFont(30),
      fontWeight: '900',
    },
    subtitle: {
      color: colors.greenLight,
      fontSize: scaleFont(14),
      fontWeight: '800',
      marginTop: 4,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    card: {
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    label: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '800',
      marginBottom: spacing.xs,
    },
    labelSpaced: {
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
      fontSize: scaleFont(15),
      fontWeight: '600',
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.cardDark,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
    },
    checkboxChecked: {
      backgroundColor: colors.greenLight,
      borderColor: colors.greenLight,
    },
    rememberText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '700',
      flex: 1,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(13),
      fontWeight: '700',
      marginTop: spacing.md,
    },
    buttonSpacing: {
      marginTop: spacing.lg,
    },
    footerNote: {
      color: colors.greyDark,
      fontSize: scaleFont(12),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.xl,
      lineHeight: scaleLine(17),
    },
  });
