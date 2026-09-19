import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../i18n/LanguageContext';
import { formatDuration } from '../lib/slots';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';
import AnimatedPressable from './AnimatedPressable';

const MAX_HOURS = 24;
// 1h, 2h, ... 24h — a block can run the whole day in one go.
const HOUR_OPTIONS = Array.from({ length: MAX_HOURS }, (_, index) => (index + 1) * 60);

type HourDropdownProps = {
  /** Selected duration in minutes. Ignored while `allDay` is true. */
  value: number;
  onChange: (minutes: number) => void;
  allDay: boolean;
  onAllDayChange: (allDay: boolean) => void;
};

/**
 * A free-form "how many hours" picker for Block Slot, separate from the
 * fixed-chip DurationPicker used for bookings elsewhere (add-external-booking,
 * manage-block) — those stay tied to the pitch's normal booking lengths, but
 * blocking time off should let an owner pick any whole-hour span, or the
 * entire day.
 *
 * Built as a button + Modal list (like ConfirmDialog) rather than a native
 * <select> or the RN Picker, since this needs to render identically on phone
 * and on the web build.
 */
export default function HourDropdown({ value, onChange, allDay, onAllDayChange }: HourDropdownProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isOpen, setIsOpen] = React.useState(false);

  const label = allDay ? t('durationPicker.allDay') : formatDuration(value);

  function select(minutes: number | 'all-day') {
    setIsOpen(false);
    if (minutes === 'all-day') {
      onAllDayChange(true);
    } else {
      onAllDayChange(false);
      onChange(minutes);
    }
  }

  return (
    <>
      <AnimatedPressable pressedScale={0.98} style={styles.field} onPress={() => setIsOpen(true)}>
        <Text style={styles.fieldText}>{label}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.grey} />
      </AnimatedPressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>{t('blockSlot.lengthStep')}</Text>

            <FlatList
              data={HOUR_OPTIONS}
              keyExtractor={(minutes) => String(minutes)}
              style={styles.list}
              ListHeaderComponent={
                <Option
                  styles={styles}
                  label={t('durationPicker.allDay')}
                  isSelected={allDay}
                  onPress={() => select('all-day')}
                />
              }
              renderItem={({ item: minutes }) => (
                <Option
                  styles={styles}
                  label={formatDuration(minutes)}
                  isSelected={!allDay && minutes === value}
                  onPress={() => select(minutes)}
                />
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Option({
  styles,
  label,
  isSelected,
  onPress,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.optionPressed]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{label}</Text>
      {isSelected ? <Ionicons name="checkmark" size={18} color={colors.greenLight} /> : null}
    </Pressable>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    fieldText: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '800',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '70%',
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.white,
      fontSize: scaleFont(16),
      fontWeight: '900',
      marginBottom: spacing.sm,
    },
    list: {
      flexGrow: 0,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    optionSelected: {
      backgroundColor: colors.greenSoft,
    },
    optionPressed: {
      opacity: 0.7,
    },
    optionText: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '700',
    },
    optionTextSelected: {
      color: colors.greenLight,
    },
  });
