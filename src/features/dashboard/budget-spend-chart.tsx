import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Card } from '@/components/card';
import { AnimatedFill, PressableScale } from '@/components/motion';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { createStyles, useColors, useTheme } from '@/context/theme';

export type DepartmentSpend = {
  id: string;
  name: string;
  allocated: number;
  spent: number;
};

type BudgetSpendChartProps = {
  rows: DepartmentSpend[];
  onOpenDepartment: (departmentId: string) => void;
};

function percentUsed(row: DepartmentSpend): number | null {
  return row.allocated > 0 ? Math.round((row.spent / row.allocated) * 100) : null;
}

// Allocated vs spent per department as paired horizontal bars on one shared
// scale. Tapping a department expands its numbers and a link to open it.
export function BudgetSpendChart({ rows, onOpenDepartment }: BudgetSpendChartProps) {
  const styles = useStyles();
  const colors = useColors();
  const { chartColors } = useTheme();
  const formatMoney = useFormatMoney();
  const [selected, setSelected] = useState<string | null>(null);

  const max = Math.max(...rows.flatMap((row) => [row.allocated, row.spent]), 1);
  const totalAllocated = rows.reduce((sum, row) => sum + row.allocated, 0);
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  const totalUsed = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : null;

  return (
    <Card style={styles.card}>
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Spent</Text>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(totalSpent)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Allocated</Text>
          <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(totalAllocated)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Used</Text>
          <Text style={styles.summaryValue}>{totalUsed === null ? '—' : `${totalUsed}%`}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: chartColors.allocated }]} />
          <Text style={styles.legendText}>Allocated</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: chartColors.spent }]} />
          <Text style={styles.legendText}>Spent</Text>
        </View>
        <Text style={styles.legendHint}>Tap a department</Text>
      </View>

      {rows.map((row) => {
        const isSelected = selected === row.id;
        const used = percentUsed(row);
        const over = row.allocated > 0 && row.spent > row.allocated;
        return (
          <PressableScale
            haptic="select"
            key={row.id}
            // Expanding a row eases the height change instead of jumping.
            layout={LinearTransition.duration(220)}
            onPress={() => setSelected(isSelected ? null : row.id)}
            accessibilityRole="button"
            accessibilityState={{ expanded: isSelected }}
            accessibilityLabel={`${row.name}: ${formatMoney(row.spent)} spent of ${formatMoney(row.allocated)} allocated`}
            style={({ pressed }) => [
              styles.row,
              isSelected && styles.rowSelected,
              pressed && styles.rowPressed,
              selected && !isSelected && styles.faded,
            ]}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowName} numberOfLines={1}>
                {row.name}
              </Text>
              {over ? (
                <View style={styles.overBadge}>
                  <Ionicons name="alert-circle" size={13} color={colors.danger} />
                  <Text style={styles.overText}>Over budget</Text>
                </View>
              ) : (
                <Text style={styles.rowUsed}>{used === null ? 'No budget' : `${used}% used`}</Text>
              )}
            </View>

            <View style={styles.bars}>
              <View style={styles.track}>
                <AnimatedFill
                  percent={(row.allocated / max) * 100}
                  style={[styles.bar, { backgroundColor: chartColors.allocated }]}
                />
              </View>
              <View style={styles.track}>
                <AnimatedFill
                  percent={(row.spent / max) * 100}
                  style={[styles.bar, { backgroundColor: over ? colors.danger : chartColors.spent }]}
                />
              </View>
            </View>

            {isSelected && (
              <Animated.View entering={FadeInDown.duration(180)} style={styles.details}>
                <Detail label="Allocated" value={formatMoney(row.allocated)} />
                <Detail label="Spent" value={formatMoney(row.spent)} />
                <Detail
                  label={over ? 'Over by' : 'Remaining'}
                  value={formatMoney(Math.abs(row.allocated - row.spent))}
                  danger={over}
                />
                <PressableScale haptic="select" onPress={() => onOpenDepartment(row.id)} style={styles.openLink} accessibilityRole="link">
                  <Text style={styles.openLinkText}>Open {row.name}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </PressableScale>
              </Animated.View>
            )}
          </PressableScale>
        );
      })}
    </Card>
  );
}

function Detail({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, danger && styles.detailDanger]}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.three,
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  summaryItem: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.four,
    paddingBottom: spacing.one,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingTop: spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  legendHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
    paddingBottom: spacing.two,
  },
  row: {
    gap: spacing.two,
    padding: spacing.two,
    borderRadius: 10,
  },
  rowSelected: {
    backgroundColor: colors.primarySoft,
  },
  rowPressed: {
    opacity: 0.75,
  },
  faded: {
    opacity: 0.45,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  rowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowUsed: {
    fontSize: 12,
    color: colors.textMuted,
  },
  overBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  overText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
  },
  bars: {
    gap: 3,
  },
  track: {
    height: 8,
  },
  bar: {
    height: '100%',
    minWidth: 3,
    borderRadius: 4,
  },
  details: {
    gap: spacing.one,
    paddingTop: spacing.two,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailDanger: {
    color: colors.danger,
  },
  openLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    alignSelf: 'flex-start',
    paddingTop: spacing.two,
  },
  openLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
}));
