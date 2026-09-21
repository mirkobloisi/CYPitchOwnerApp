import React, { ReactNode, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { PickedAvatarImage } from '../lib/avatarUpload';

type AvatarPickerTriggerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  onPicked: (image: PickedAvatarImage) => void;
  onError: (error: unknown) => void;
};

// expo-image-picker's own web shim opens the file dialog by dispatching a
// synthetic MouseEvent, which browsers never treat as trusted, so the
// dialog silently never opens. Calling input.click() ourselves from an
// onPress handler doesn't fix it either — React Native Web's Pressable
// doesn't invoke onPress synchronously off the raw browser click (its
// gesture/responder handling defers it), so by the time our code runs the
// browser's activation window for opening a file chooser has already
// closed ("File chooser dialog can only be shown with a user activation").
//
// The only thing that reliably survives all of that: a real
// <input type="file"> that IS the element the user's browser click
// physically lands on, with zero JS indirection in between. So this
// overlays one, invisible, on top of the pressable content — added
// imperatively to a React-Native View that never has any JSX children of
// its own, so it can't conflict with React's own DOM reconciliation.
export default function AvatarPickerTrigger({
  children,
  style,
  disabled,
  onPicked,
  onError,
}: AvatarPickerTriggerProps) {
  const overlayRef = useRef<View>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const overlayNode = overlayRef.current as unknown as HTMLElement | null;
    if (!overlayNode) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    Object.assign(input.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      opacity: '0',
      cursor: 'pointer',
      margin: '0',
      padding: '0',
      border: 'none',
    });

    function handleChange() {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;

      const uri = URL.createObjectURL(file);
      const image = new window.Image();
      image.onload = () => onPicked({ uri, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => onError(new Error('Could not read the selected image.'));
      image.src = uri;
    }

    input.addEventListener('change', handleChange);
    overlayNode.appendChild(input);
    inputRef.current = input;

    return () => {
      input.removeEventListener('change', handleChange);
      input.remove();
      inputRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.pointerEvents = disabled ? 'none' : 'auto';
    }
  }, [disabled]);

  return (
    <View style={[{ position: 'relative' }, style]}>
      {children}
      <View
        ref={overlayRef}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}
