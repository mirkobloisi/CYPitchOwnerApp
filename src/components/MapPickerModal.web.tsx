import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from './AnimatedPressable';
import AppButton from './AppButton';
import { useTranslation } from '../i18n/LanguageContext';
import { Place, describePoint } from '../lib/placeSearch';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

type MapPickerModalProps = {
  visible: boolean;
  onSelect: (place: Place) => void;
  onClose: () => void;
};

/**
 * The page dropped into the iframe: an OpenStreetMap slippy map, which is what
 * anyone means by "a map". Leaflet is loaded from a CDN rather than bundled,
 * because it only ever runs inside this frame.
 *
 * A click posts the coordinates back out; naming the spot happens on the React
 * side, so this stays a map and nothing more.
 */
const MAP_PAGE = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; background: #0d1117; }
      .leaflet-container { font: inherit; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      // Cyprus, where the first academies are. The map moves the moment
      // somebody drags it, so this is only a starting view.
      var map = L.map('map').setView([35.1264, 33.4299], 9);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var marker = null;

      map.on('click', function (event) {
        if (marker) map.removeLayer(marker);
        marker = L.marker(event.latlng).addTo(map);

        parent.postMessage({
          source: 'mypitch-map',
          latitude: event.latlng.lat,
          longitude: event.latlng.lng
        }, '*');
      });
    </script>
  </body>
</html>`;

export default function MapPickerModal({ visible, onSelect, onClose }: MapPickerModalProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pending, setPending] = useState<Place | null>(null);
  const [isNaming, setIsNaming] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!visible) {
      setPending(null);
      return;
    }

    async function onMessage(event: MessageEvent) {
      const data = event.data as
        | { source?: string; latitude?: number; longitude?: number }
        | undefined;

      if (data?.source !== 'mypitch-map') return;
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;

      setIsNaming(true);
      // What is actually there: the map gives a point, not a name.
      setPending(await describePoint(data.latitude, data.longitude));
      setIsNaming(false);
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [visible]);

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

          <Text style={styles.hint}>{t('placeSearch.tapHint')}</Text>

          <View style={styles.mapWrap}>
            {/* @ts-expect-error — an iframe is plain DOM, which react-native-web
                renders as-is on the web build. */}
            <iframe
              ref={frameRef}
              srcDoc={MAP_PAGE}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={t('placeSearch.title')}
            />
          </View>

          {isNaming ? (
            <View style={styles.pendingBox}>
              <ActivityIndicator color={colors.greenLight} size="small" />
              <Text style={styles.pendingText}>{t('placeSearch.searching')}</Text>
            </View>
          ) : pending ? (
            // The confirmation: a tap on a map is easy to make by accident.
            <View style={styles.pendingBox}>
              <Ionicons name="location" size={18} color={colors.greenLight} />

              <View style={styles.pendingInfo}>
                <Text style={styles.pendingTitle}>{t('academy.confirmPlaceTitle')}</Text>
                <Text style={styles.pendingText} numberOfLines={3}>
                  {t('academy.confirmPlaceBody').replace(
                    '{name}',
                    pending.name || pending.address
                  )}
                </Text>
              </View>
            </View>
          ) : null}

          {pending ? (
            <AppButton
              title={t('academy.confirmPlaceAction')}
              onPress={() => {
                onSelect(pending);
                onClose();
              }}
            />
          ) : null}

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
      maxWidth: 620,
      maxHeight: '90%',
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
    hint: {
      color: colors.grey,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    mapWrap: {
      height: 340,
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    pendingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.borderGreen,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    pendingInfo: {
      flex: 1,
      minWidth: 0,
    },
    pendingTitle: {
      color: colors.white,
      fontSize: scaleFont(13),
      fontWeight: '900',
    },
    pendingText: {
      color: colors.greySoft,
      fontSize: scaleFont(12),
      fontWeight: '600',
      marginTop: 2,
      lineHeight: 16,
    },
    credit: {
      color: colors.greyDark,
      fontSize: scaleFont(10),
      fontWeight: '600',
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
