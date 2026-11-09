import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { radius, spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

type PagerProps = {
  page: number;
  // Known for page-numbered lists; cursor-based lists only know if there's more.
  totalPages?: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

// Previous / Page N / Next controls shown under a paged list.
export function Pager({ page, totalPages, hasNext, onPrevious, onNext }: PagerProps) {
  const styles = useStyles();
  const colors = useColors();
  const hasPrevious = page > 1;
  return (
    <View style={styles.pager}>
      <PressableScale
        haptic="select"
        onPress={onPrevious}
        disabled={!hasPrevious}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
        style={({ pressed }) => [styles.button, !hasPrevious && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={18} color={hasPrevious ? colors.primary : colors.textMuted} />
        <Text style={[styles.buttonText, !hasPrevious && styles.buttonTextDisabled]}>Previous</Text>
      </PressableScale>
      <Text style={styles.label}>{totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}</Text>
      <PressableScale
        haptic="select"
        onPress={onNext}
        disabled={!hasNext}
        accessibilityRole="button"
        accessibilityLabel="Next page"
        style={({ pressed }) => [styles.button, !hasNext && styles.disabled, pressed && styles.pressed]}>
        <Text style={[styles.buttonText, !hasNext && styles.buttonTextDisabled]}>Next</Text>
        <Ionicons name="chevron-forward" size={18} color={hasNext ? colors.primary : colors.textMuted} />
      </PressableScale>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.four,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.three,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
  label: {
    fontSize: 13,
    color: colors.textSecondary,
  },
}));
