import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '../../components/AppButton';
import Screen from '../../components/Screen';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuth } from '../../lib/auth';
import { getRememberMe, setRememberMe } from '../../lib/rememberMe';
import { AppColors } from '../../theme/palettes';
import { useAppTheme } from '../../theme/ThemeContext';
import { radius, spacing } from '../../theme/layout';
import { scaleFont, scaleLine } from '../../theme/typography';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signUp } = useAuth();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(getRememberMe());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState<'session' | 'confirmEmail' | null>(null);

  // Only the website has a session that can outlive the app being closed; on
  // a phone the session always persists, so the choice would mean nothing.
  const isWeb = Platform.OS === 'web';

  const contactRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function handleSignup() {
    setErrorMessage('');

    if (!businessName.trim() || !contactName.trim() || !phone.trim() || !email.trim()) {
      setErrorMessage(t('signup.errorRequired'));
      return;
    }

    if (password.length < 6) {
      setErrorMessage(t('signup.errorPasswordLength'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('signup.errorPasswordMatch'));
      return;
    }

    // Recorded before signing up, so that if the account comes back with a
    // session attached it is stored where the owner asked for it to be.
    setRememberMe(remember);

    setIsSubmitting(true);

    const { error, needsEmailConfirmation } = await signUp({
      email: email.trim(),
      password,
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setSubmitted(needsEmailConfirmation ? 'confirmEmail' : 'session');
  }

  if (submitted) {
    return (
      <Screen scroll={false} contentStyle={styles.screenContent}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.greenLight} />
        </View>
        <Text style={styles.successTitle}>{t('signup.successTitle')}</Text>
        <Text style={styles.successText}>
          {submitted === 'confirmEmail'
            ? t('signup.successConfirmEmailText')
            : t('signup.successText')}
        </Text>
        <View style={styles.buttonSpacing}>
          <AppButton
            title={t('signup.backToLogin')}
            variant="outline"
            onPress={() => router.replace('/login')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.screenContent}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Ionicons name="football" size={30} color={colors.greenLight} />
          </View>
          <Text style={styles.brand}>{t('signup.heading')}</Text>
          <Text style={styles.subtitle}>{t('signup.subtitle')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t('signup.businessNameLabel')}</Text>
          <TextInput
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={t('signup.businessNamePlaceholder')}
            placeholderTextColor={colors.greyDark}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => contactRef.current?.focus()}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('signup.contactNameLabel')}</Text>
          <TextInput
            ref={contactRef}
            value={contactName}
            onChangeText={setContactName}
            placeholder={t('signup.contactNamePlaceholder')}
            placeholderTextColor={colors.greyDark}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('signup.phoneLabel')}</Text>
          <TextInput
            ref={phoneRef}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('signup.phonePlaceholder')}
            placeholderTextColor={colors.greyDark}
            keyboardType="phone-pad"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('signup.emailLabel')}</Text>
          <TextInput
            ref={emailRef}
            value={email}
            onChangeText={setEmail}
            placeholder={t('signup.emailPlaceholder')}
            placeholderTextColor={colors.greyDark}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('signup.passwordLabel')}</Text>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.greyDark}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            style={styles.input}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('signup.confirmPasswordLabel')}</Text>
          <TextInput
            ref={confirmRef}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.greyDark}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={handleSignup}
            style={styles.input}
          />

          {isWeb ? (
            <Pressable style={styles.rememberRow} onPress={() => setRemember((value) => !value)}>
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember ? <Ionicons name="checkmark" size={14} color={colors.blackText} /> : null}
              </View>
              <Text style={styles.rememberText}>{t('signup.rememberMe')}</Text>
            </Pressable>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.buttonSpacing}>
            <AppButton title={t('signup.submitButton')} onPress={handleSignup} loading={isSubmitting} />
          </View>
        </View>

        <Text style={styles.footerNote}>{t('signup.footerNote')}</Text>

        <AppButton
          title={t('signup.backToLogin')}
          variant="ghost"
          style={styles.backButton}
          onPress={() => router.replace('/login')}
        />
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    screenContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    logoBadge: {
      width: 64,
      height: 64,
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
      fontSize: scaleFont(24),
      fontWeight: '900',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: scaleLine(18),
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
    backButton: {
      marginTop: spacing.md,
    },
    successIcon: {
      alignSelf: 'center',
      width: 84,
      height: 84,
      borderRadius: radius.round,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xl,
    },
    successTitle: {
      color: colors.white,
      fontSize: scaleFont(22),
      fontWeight: '900',
      textAlign: 'center',
    },
    successText: {
      color: colors.grey,
      fontSize: scaleFont(14),
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: scaleLine(20),
      marginTop: spacing.sm,
      maxWidth: 320,
      alignSelf: 'center',
    },
  });
