import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { formatMonth } from '@/lib/format';

export type MonthValue = { month: number; year: number };

export function currentMonth(): MonthValue {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

function shift(value: MonthValue, delta: number): MonthValue {
  const index = value.year * 12 + (value.month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

export function MonthSwitcher({ value, onChange }: { value: MonthValue; onChange: (value: MonthValue) => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.container}>
      <PressableScale haptic="select" onPress={() => onChange(shift(value, -1))} hitSlop={8} accessibilityLabel="Previous month">
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </PressableScale>
      <Text style={styles.label}>{formatMonth(value.month, value.year)}</Text>
      <PressableScale haptic="select" onPress={() => onChange(shift(value, 1))} hitSlop={8} accessibilityLabel="Next month">
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
}));
