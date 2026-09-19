import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CONTENT_MAX_WIDTH, useBreakpoint } from '../theme/breakpoints';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/layout';
import AnimatedBackground from './AnimatedBackground';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Reading width on a large screen. Content is centred rather than stretched
   * edge to edge across a monitor; pass a larger value for screens that make
   * good use of the space, such as the Agenda.
   */
  maxWidth?: number;
};

export default function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  maxWidth = CONTENT_MAX_WIDTH,
}: ScreenProps) {
  const { colors } = useAppTheme();
  const { isWide } = useBreakpoint();
  const styles = makeStyles(colors);

  // Only constrain on a roomy screen; a phone keeps using its full width.
  const widthStyle: ViewStyle = isWide
    ? { width: '100%', maxWidth, alignSelf: 'center' }
    : {};

  return (
    <AnimatedBackground style={[styles.root, style]}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {scroll ? (
            <ScrollView
              style={styles.container}
              contentContainerStyle={[styles.content, widthStyle, contentStyle]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.container, styles.content, widthStyle, contentStyle]}>
              {children}
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AnimatedBackground>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: 120,
    },
  });
