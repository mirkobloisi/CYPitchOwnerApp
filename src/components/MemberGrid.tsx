import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from './AnimatedPressable';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export type GridMember = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  member_kind: 'guardian' | 'player' | 'staff';
  /** Free-text second line: an age, a position, whatever the caller has. */
  meta?: string | null;
};

type MemberGridProps = {
  members: GridMember[];
  /** Signed photo URLs by member id — see signedMemberAvatars. */
  avatars: Record<string, string | null>;
  emptyText: string;
  onPress?: (member: GridMember) => void;
};

/**
 * A roster as small tiles that flow across and then down, rather than one
 * name per full-width row.
 *
 * An academy has dozens of children; a vertical list shows six of them on a
 * phone and makes the owner scroll for the rest. Tiles put a face to each
 * name and fit three or four to a row, so a squad is one glance instead of a
 * page of scrolling.
 */
export default function MemberGrid({ members, avatars, emptyText, onPress }: MemberGridProps) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  if (members.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="people-outline" size={22} color={colors.greyDark} />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {members.map((member) => {
        const isPlayer = member.member_kind === 'player';
        const photo = avatars[member.id];

        const tile = (
          <View style={styles.tile}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons
                  name={isPlayer ? 'football-outline' : 'person'}
                  size={18}
                  color={isPlayer ? colors.blueLight : colors.greyDark}
                />
              </View>
            )}

            <Text style={styles.name} numberOfLines={1}>
              {member.full_name}
            </Text>

            {member.meta ? (
              <Text style={styles.meta} numberOfLines={1}>
                {member.meta}
              </Text>
            ) : null}
          </View>
        );

        return onPress ? (
          <AnimatedPressable
            key={member.id}
            style={styles.cell}
            pressedScale={0.96}
            hoverScale={1.03}
            onPress={() => onPress(member)}
          >
            {tile}
          </AnimatedPressable>
        ) : (
          <View key={member.id} style={styles.cell}>
            {tile}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -4,
      marginBottom: spacing.sm,
    },
    // A quarter-width cell wraps to three per row on a narrow phone once the
    // tile's own minimum width bites, and four on anything wider.
    cell: {
      width: '25%',
      minWidth: 92,
      padding: 4,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.cardSoft,
      marginBottom: 6,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      color: colors.white,
      fontSize: scaleFont(11),
      fontWeight: '800',
      textAlign: 'center',
    },
    meta: {
      color: colors.grey,
      fontSize: scaleFont(10),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 1,
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      textAlign: 'center',
    },
  });
