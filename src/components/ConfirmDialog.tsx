import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont, scaleLine } from '../theme/typography';

export type ConfirmAction = {
  label: string;
  tone?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  actions: ConfirmAction[];
  onDismiss: () => void;
};

/**
 * Replaces React Native's Alert, which react-native-web does not implement —
 * on the website an Alert call silently does nothing, so a confirmation would
 * never appear and the action would seem broken. This renders the same dialog
 * on phone and in a browser.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  actions,
  onDismiss,
}: ConfirmDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Swallows taps on the card so they don't dismiss the dialog. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [
                  styles.action,
                  action.tone === 'destructive' && styles.actionDestructive,
                  action.tone === 'cancel' && styles.actionCancel,
                  pressed && styles.actionPressed,
                ]}
                onPress={() => {
                  onDismiss();
                  action.onPress?.();
                }}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.tone === 'destructive' && styles.actionTextDestructive,
                    action.tone === 'cancel' && styles.actionTextCancel,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    title: {
      color: colors.white,
      fontSize: scaleFont(17),
      fontWeight: '900',
    },
    message: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      lineHeight: scaleLine(19),
      marginTop: spacing.sm,
    },
    actions: {
      marginTop: spacing.lg,
      gap: spacing.xs,
    },
    action: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      backgroundColor: colors.greenSoft,
      paddingVertical: 12,
      alignItems: 'center',
    },
    actionCancel: {
      borderColor: colors.border,
      backgroundColor: colors.cardDark,
    },
    actionDestructive: {
      borderColor: 'rgba(255, 69, 58, 0.35)',
      backgroundColor: colors.redSoft,
    },
    actionPressed: {
      opacity: 0.75,
    },
    actionText: {
      color: colors.greenLight,
      fontSize: scaleFont(14),
      fontWeight: '800',
    },
    actionTextCancel: {
      color: colors.grey,
    },
    actionTextDestructive: {
      color: colors.red,
    },
  });
