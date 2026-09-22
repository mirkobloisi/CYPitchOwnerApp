import React, { ReactNode, useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

type AnimatedSwapProps = {
  /** Changing this re-runs the fade — pass whatever identifies the content. */
  swapKey: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
};

/**
 * Cross-fades its content whenever `swapKey` changes, so switching a view
 * mode, a filter or a selected day reads as a transition instead of a jump.
 *
 * Uses the core Animated API rather than Reanimated's `entering`: this runs
 * identically on web and native, and an opacity-only fade carries no motion,
 * so it stays appropriate even when the OS asks for reduced motion.
 */
export default function AnimatedSwap({
  swapKey,
  children,
  style,
  duration = 220,
}: AnimatedSwapProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [swapKey, duration, opacity]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}
