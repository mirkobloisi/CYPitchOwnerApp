import React, { ReactNode, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

type AnimatedPressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export default function AnimatedPressable({
  children,
  style,
  pressedScale = 0.94,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateTo(scaleValue: number, opacityValue: number) {
    Animated.spring(scale, {
      toValue: scaleValue,
      speed: 32,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: opacityValue,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }

  function handlePressIn(event: GestureResponderEvent) {
    if (!disabled) {
      animateTo(pressedScale, 0.85);
    }

    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    if (!disabled) {
      animateTo(1, 1);
    }

    onPressOut?.(event);
  }

  return (
    <Pressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      {...props}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity,
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
