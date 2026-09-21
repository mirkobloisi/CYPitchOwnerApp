import React, { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import { AvatarPickCancelledError, pickAvatarImage, PickedAvatarImage } from '../lib/avatarUpload';
import AnimatedPressable from './AnimatedPressable';

type AvatarPickerTriggerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onPicked: (image: PickedAvatarImage) => void;
  onError: (error: unknown) => void;
};

// Native (iOS/Android): the device's own photo library picker, via the
// existing onPress flow. See AvatarPickerTrigger.web.tsx for why web needs a
// completely different mechanism.
export default function AvatarPickerTrigger({
  children,
  style,
  disabled,
  onPicked,
  onError,
}: AvatarPickerTriggerProps) {
  async function handlePress() {
    try {
      const image = await pickAvatarImage();
      onPicked(image);
    } catch (error) {
      if (!(error instanceof AvatarPickCancelledError)) {
        onError(error);
      }
    }
  }

  return (
    <AnimatedPressable pressedScale={0.95} disabled={disabled} style={style} onPress={handlePress}>
      {children}
    </AnimatedPressable>
  );
}
