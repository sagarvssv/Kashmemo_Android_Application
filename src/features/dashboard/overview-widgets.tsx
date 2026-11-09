import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { ProgressBar } from '@/components/stat-tile';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { createStyles, useColors } from '@/context/theme';

// Building blocks shared by the CEO/HR and Finance Manager home screens.

// Overall spend against allocation for the month; opens the budgets screen.
export function BudgetUsageCard({
  allocated,
  spent,
  monthLabel,
}: {
  allocated: number;
  spent: number;
  monthLabel: string;
}) {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const used = allocated > 0 ? Math.round((spent / allocated) * 100) : null;
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push('/departments')}
      accessibilityRole="button"
      accessibilityLabel={`Budget used: ${used ?? 0} percent. Open budgets.`}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <Card style={styles.usage}>
        <View style={styles.usageHeader}>
          <Text style={styles.usageTitle}>Budget used</Text>
          <Text style={[styles.usagePercent, used !== null && used > 100 && styles.danger]}>
            {used === null ? '—' : `${used}%`}
          </Text>
        </View>
        <ProgressBar value={spent} max={allocated} />
        <Text style={styles.usageMeta}>
          {allocated > 0
            ? `${formatMoney(spent)} of ${formatMoney(allocated)} spent in ${monthLabel}`
            : `No budgets allocated for ${monthLabel} yet`}
        </Text>
      </Card>
    </PressableScale>
  );
}

export function AttentionList({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.attention}>{children}</View>;
}

// One-line shortcut such as "3 awaiting approval · AED 1,240 ›".
export function AttentionChip({
  icon,
  count,
  label,
  detail,
  href,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  count: number | string;
  label: string;
  detail?: string;
  href: Href;
  danger?: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const tint = danger ? colors.danger : colors.primary;
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={[`${count} ${label}`, detail].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.chip, danger && styles.chipDanger, pressed && styles.pressed]}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.chipCount, { color: tint }]}>{count}</Text>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
      {detail ? <Text style={styles.chipDetail}>{detail}</Text> : null}
      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  pressed: {
    opacity: 0.7,
  },
  danger: {
    color: colors.danger,
  },
  usage: {
    gap: spacing.two,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  usageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  usagePercent: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  usageMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  attention: {
    gap: spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
  },
  chipDanger: {
    borderColor: colors.danger,
  },
  chipCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  chipLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  chipDetail: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
}));
