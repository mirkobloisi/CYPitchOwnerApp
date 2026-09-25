import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AnimatedPressable from './AnimatedPressable';
import { useTranslation } from '../i18n/LanguageContext';
import { Place, searchPlaces } from '../lib/placeSearch';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

type PlaceSearchModalProps = {
  visible: boolean;
  onSelect: (place: Place) => void;
  onClose: () => void;
};

/**
 * Finds a ground anywhere on the map, for an away match at a pitch the owner
 * does not run.
 *
 * Typing is debounced rather than searched per keystroke: the lookup service
 * asks callers to stay under a request a second, and a person types faster
 * than that.
 */
export default function PlaceSearchModal({ visible, onSelect, onClose }: PlaceSearchModalProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // A fresh search each time it opens, rather than last time's results.
  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || query.trim().length < 3) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      const found = await searchPlaces(query);
      if (cancelled) return;

      setResults(found);
      setHasSearched(true);
      setIsSearching(false);
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('placeSearch.title')}</Text>
            <AnimatedPressable style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.grey} />
            </AnimatedPressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color={colors.greyDark} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('placeSearch.placeholder')}
              placeholderTextColor={colors.greyDark}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {isSearching ? <ActivityIndicator color={colors.greenLight} size="small" /> : null}
          </View>

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="map-outline" size={24} color={colors.greyDark} />
                <Text style={styles.emptyText}>
                  {query.trim().length < 3
                    ? t('placeSearch.hint')
                    : hasSearched && !isSearching
                      ? t('placeSearch.noResults')
                      : t('placeSearch.searching')}
                </Text>
              </View>
            ) : (
              results.map((place) => (
                <AnimatedPressable
                  key={`${place.latitude},${place.longitude},${place.name}`}
                  pressedScale={0.98}
                  hoverScale={1.01}
                  onPress={() => {
                    onSelect(place);
                    onClose();
                  }}
                >
                  <View style={styles.row}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="location" size={16} color={colors.greenLight} />
                    </View>

                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={2}>
                        {place.address}
                      </Text>
                    </View>
                  </View>
                </AnimatedPressable>
              ))
            )}
          </ScrollView>

          {/* Required by the map data's licence wherever its results are shown. */}
          <Text style={styles.credit}>{t('placeSearch.credit')}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '82%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.white,
      fontSize: scaleFont(15),
      fontWeight: '800',
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardSoft,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '600',
      padding: 0,
    },
    results: {
      maxHeight: 340,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: 8,
    },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenSoft,
    },
    rowInfo: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color: colors.white,
      fontSize: scaleFont(13),
      fontWeight: '800',
    },
    rowMeta: {
      color: colors.grey,
      fontSize: scaleFont(11),
      fontWeight: '600',
      marginTop: 2,
      lineHeight: 15,
    },
    emptyBox: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      textAlign: 'center',
    },
    credit: {
      color: colors.greyDark,
      fontSize: scaleFont(10),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
