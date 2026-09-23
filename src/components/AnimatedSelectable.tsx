import React, { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  ViewStyle,
} from 'react-native';

type ColorPair = readonly [inactive: string, active: string];

type AnimatedSelectableProps = {
  active: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Animated between the inactive and active colour as `active` flips. */
  background?: ColorPair;
  borderColor?: ColorPair;
  /**
   * Content. Pass a function to receive the 0→1 progress value, so a label
   * can interpolate its own colour in step with the container.
   */
  children: ReactNode | ((progress: Animated.Value) => ReactNode);
  duration?: number;
};

/**
 * A pressable whose selected state fades in instead of snapping — used for
 * segmented controls, filter chips and calendar day cells.
 *
 * Colour interpolation can't run on the native driver, so this animation is
 * JS-driven. That's fine here: it only runs on an explicit tap, over a couple
 * of small elements.
 */
export default function AnimatedSelectable({
  active,
  onPress,
  disabled,
  style,
  background,
  borderColor,
  children,
  duration = 240,
}: AnimatedSelectableProps) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration,
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [active, duration, progress]);

  function animateScale(value: number) {
    Animated.spring(scale, {
      toValue: value,
      speed: 32,
      bounciness: 7,
      useNativeDriver: false,
    }).start();
  }

  function handlePressIn(_event: GestureResponderEvent) {
    if (!disabled) animateScale(0.94);
  }

  function handlePressOut(_event: GestureResponderEvent) {
    if (!disabled) animateScale(1);
  }

  const animatedColors: ViewStyle = {};
  if (background) {
    animatedColors.backgroundColor = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [...background],
    }) as unknown as string;
  }
  if (borderColor) {
    animatedColors.borderColor = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [...borderColor],
    }) as unknown as string;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={() => !disabled && animateScale(1.03)}
      onHoverOut={() => !disabled && animateScale(1)}
      style={[style, animatedColors, { transform: [{ scale }] }]}
    >
      {typeof children === 'function' ? children(progress) : children}
    </AnimatedPressable>
  );
}

// Animating the Pressable itself keeps it a single element, so a caller's
// layout styles (grid widths, aspect ratios) behave exactly as before.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
