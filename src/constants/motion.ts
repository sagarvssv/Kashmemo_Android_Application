import { Easing } from 'react-native-reanimated';

// One set of motion tokens so every animation in the app feels related:
// quick, soft springs for touch; eased timing for things that grow or appear.
export const motion = {
  // Press feedback: scale down a touch, spring back without wobble.
  pressScale: 0.97,
  pressSpring: { damping: 20, stiffness: 400, mass: 0.6 },
  // Bars and meters filling to their value.
  fillDuration: 700,
  fillEasing: Easing.out(Easing.cubic),
  // Content arriving on screen.
  enterDuration: 380,
  // Delay between successive items in a cascade, and the cap so long lists
  // don't keep the last rows waiting.
  staggerStep: 55,
  staggerMax: 8,
  // Sliding indicators (segmented control).
  slideSpring: { damping: 22, stiffness: 260, mass: 0.8 },
} as const;

export function staggerDelay(index: number): number {
  return Math.min(index, motion.staggerMax) * motion.staggerStep;
}
