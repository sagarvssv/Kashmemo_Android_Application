import React, { useEffect, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion, staggerDelay } from '@/constants/motion';
import { haptics } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  // Layout animations, applied to a wrapper view (see below).
  entering?: React.ComponentProps<typeof Animated.View>['entering'];
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  // Feedback on press: a light tap for actions, a tick for selections.
  haptic?: 'tap' | 'select';
  // How far to shrink while held (1 = no scaling).
  scaleTo?: number;
};

// Pressable that springs down slightly while held, the press feedback used
// across the app. Accepts the same `style` (object or ({ pressed }) => style)
// as Pressable.
export function PressableScale({
  style,
  haptic,
  scaleTo = motion.pressScale,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  entering,
  layout,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const resolved = typeof style === 'function' ? style({ pressed }) : style;

  const pressable = (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        scale.set(withSpring(scaleTo, motion.pressSpring));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        scale.set(withSpring(1, motion.pressSpring));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic === 'tap') haptics.tap();
        if (haptic === 'select') haptics.select();
        onPress?.(event);
      }}
      style={[resolved, animatedStyle]}
    />
  );

  // Layout animations also drive `transform`, so they go on a wrapper rather
  // than fighting the press scale on the same view.
  if (!entering && !layout) return pressable;
  return (
    <Animated.View entering={entering} layout={layout}>
      {pressable}
    </Animated.View>
  );
}

// Fades and lifts its content into place when it mounts. `index` staggers
// siblings so a screen's sections arrive one after another.
export function Appear({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.enterDuration).delay(staggerDelay(index)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 14 }],
      })}
      style={style}>
      {children}
    </Animated.View>
  );
}

// The filled part of a bar, growing from empty to `percent` (0-100) on mount
// and easing to new values when the data changes.
export function AnimatedFill({ percent, style }: { percent: number; style?: StyleProp<ViewStyle> }) {
  const target = Math.max(0, Math.min(percent, 100));
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(withTiming(target, { duration: motion.fillDuration, easing: motion.fillEasing }));
  }, [target, width]);
  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));
  return <Animated.View style={[style, animatedStyle]} />;
}

// A placeholder block that gently pulses while content loads.
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.set(withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.55, { duration: 700 })),
      -1,
      false,
    ));
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View style={[style, animatedStyle]} />;
}
