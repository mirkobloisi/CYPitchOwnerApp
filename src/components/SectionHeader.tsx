import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { scaleFont } from '../theme/typography';

type SectionHeaderProps = {
  title: string;
  action?: string;
  onActionPress?: () => void;
};

export default function SectionHeader({
  title,
  action,
  onActionPress,
}: SectionHeaderProps) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {action ? (
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onActionPress}
          disabled={!onActionPress}
        >
          <Text style={styles.action}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.white,
    fontSize: scaleFont(22),
    fontWeight: '800',
    marginBottom: 12,
  },
  action: {
    color: colors.blueLight,
    fontSize: scaleFont(13),
    fontWeight: '800',
    marginBottom: 12,
  },
});
