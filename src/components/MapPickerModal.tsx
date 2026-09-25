import React from 'react';

import PlaceSearchModal from './PlaceSearchModal';
import { Place } from '../lib/placeSearch';

type MapPickerModalProps = {
  visible: boolean;
  onSelect: (place: Place) => void;
  onClose: () => void;
};

/**
 * Native falls back to searching by name.
 *
 * The web build (MapPickerModal.web.tsx) shows a real slippy map in an
 * iframe, which is where the Owner App is actually used. Doing the same on a
 * phone means a native map component and the key or build configuration that
 * comes with it, so until that is wanted, a phone searches for the ground by
 * name and gets the same saved result: a location name and a maps link.
 */
export default function MapPickerModal({ visible, onSelect, onClose }: MapPickerModalProps) {
  return <PlaceSearchModal visible={visible} onSelect={onSelect} onClose={onClose} />;
}
