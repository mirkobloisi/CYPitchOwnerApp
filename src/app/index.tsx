import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeContext';

// The root layout's AppGate handles redirecting to /login, /pending, or
// /(tabs)/agenda based on auth state. This screen is only ever visible for an
// instant while that redirect resolves.
export default function IndexScreen() {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator color={colors.greenLight} size="large" />
    </View>
  );
}
