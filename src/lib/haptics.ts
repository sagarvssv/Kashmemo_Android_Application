import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptic feedback, kept subtle: a light tap for presses, a tick for changing a
// selection, and notification patterns for an action's outcome. No-ops on web,
// and never throws (some Android devices have no vibration motor).
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>) {
  if (!enabled) return;
  effect().catch(() => {});
}

export const haptics = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
