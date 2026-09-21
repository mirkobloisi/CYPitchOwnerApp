import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export class AvatarPickCancelledError extends Error {}

export type PickedAvatarImage = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Opens the device's native photo library picker (iOS/Android) and returns
 * the raw chosen image, with no native crop step — cropping happens
 * afterwards in AvatarCropModal, since neither platform's own picker editor
 * offers a circular selection (Android supports shape: 'oval' but iOS's
 * editor is a plain rectangle only). Throws AvatarPickCancelledError if the
 * owner backs out of the picker.
 *
 * Web has its own picking mechanism entirely — see
 * AvatarPickerTrigger.web.tsx — because expo-image-picker's web shim opens
 * the file dialog via a synthetic click, which browsers silently ignore.
 */
export async function pickAvatarImage(): Promise<PickedAvatarImage> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Photo library access is needed to change your profile picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new AvatarPickCancelledError();
  }

  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/**
 * Crops the picked image to the given square region (in the image's own
 * pixel coordinates, as produced by AvatarCropModal), resizes it to a sane
 * upload size, and uploads it to this owner's folder in the `avatars`
 * bucket — the same bucket and storage RLS the User App's players use
 * (writes are scoped to the caller's own auth.uid() prefix, not to any
 * particular table). Returns the public URL.
 */
export async function cropAndUploadAvatar(
  userId: string,
  image: PickedAvatarImage,
  crop: { originX: number; originY: number; size: number }
): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    image.uri,
    [
      { crop: { originX: crop.originX, originY: crop.originY, width: crop.size, height: crop.size } },
      { resize: { width: 512, height: 512 } },
    ],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  const response = await fetch(manipulated.uri);
  const arrayBuffer = await response.arrayBuffer();

  // A fresh filename each time (rather than overwriting one fixed path) so a
  // CDN/browser cache never serves a stale image under the same URL.
  const path = `${userId}/avatar-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
