import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/card';
import { AnimatedFill, PressableScale } from '@/components/motion';
import { spacing } from '@/constants/theme';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { STATUS_LABELS } from '@/lib/format';
import type { TicketStatus } from '@/lib/types';

// Workflow order, so the bar reads left to right from "waiting" to "done".
const STATUSES: TicketStatus[] = ['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'DISBURSED', 'SETTLEMENT_PENDING', 'SETTLED', 'REJECTED'];

type TicketStatusChartProps = {
  counts: Partial<Record<TicketStatus, number>>;
  onOpenStatus: (status: TicketStatus) => void;
};

function percent(part: number, total: number): string {
  if (!total) return '0%';
  const value = (part / total) * 100;
  return `${value > 0 && value < 1 ? '<1' : Math.round(value)}%`;
}

// Part-to-whole view of the month's tickets: a stacked bar plus a legend list.
// Tapping a segment or a row selects that status; tapping it again clears it.
export function TicketStatusChart({ counts, onOpenStatus }: TicketStatusChartProps) {
  const styles = useStyles();
  const colors = useColors();
  const { statusChartColors } = useTheme();
  const [selected, setSelected] = useState<TicketStatus | null>(null);
  const total = STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const max = Math.max(...STATUSES.map((status) => counts[status] ?? 0), 1);
  const toggle = (status: TicketStatus) => setSelected((current) => (current === status ? null : status));

  const selectedCount = selected ? (counts[selected] ?? 0) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.headline}>
        {selected ? (
          <>
            <Text style={styles.headlineValue}>{selectedCount}</Text>
            <Text style={styles.headlineLabel}>
              {STATUS_LABELS[selected]} · {percent(selectedCount, total)} of {total}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.headlineValue}>{total}</Text>
            <Text style={styles.headlineLabel}>
              {total === 0
                ? 'No tickets raised this month'
                : `${total === 1 ? 'ticket' : 'tickets'} raised · tap a status for details`}
            </Text>
          </>
        )}
      </View>

      {total === 0 ? (
        <View style={[styles.bar, styles.emptyBar]} />
      ) : (
        <View style={styles.bar} accessibilityRole="image" accessibilityLabel={barDescription(counts, total)}>
          {STATUSES.filter((status) => (counts[status] ?? 0) > 0).map((status) => (
            <PressableScale
              haptic="select"
              key={status}
              onPress={() => toggle(status)}
              // The bar is short; extend the touch area above and below it.
              hitSlop={{ top: 12, bottom: 12 }}
              style={[
                styles.segment,
                { flex: counts[status] ?? 0, backgroundColor: statusChartColors[status] },
                selected && selected !== status && styles.faded,
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.legend}>
        {STATUSES.map((status) => {
          const count = counts[status] ?? 0;
          const isSelected = selected === status;
          return (
            <PressableScale
              haptic="select"
              key={status}
              onPress={() => toggle(status)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${STATUS_LABELS[status]}: ${count} tickets, ${percent(count, total)}`}
              style={({ pressed }) => [
                styles.row,
                isSelected && styles.rowSelected,
                pressed && styles.rowPressed,
                selected && !isSelected && styles.faded,
              ]}>
              <View style={[styles.swatch, { backgroundColor: statusChartColors[status] }]} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowLabel}>{STATUS_LABELS[status]}</Text>
                  <Text style={styles.rowCount}>{count}</Text>
                  <Text style={styles.rowPercent}>{percent(count, total)}</Text>
                </View>
                <View style={styles.track}>
                  {count > 0 && (
                    <AnimatedFill
                      percent={(count / max) * 100}
                      style={[styles.fill, { backgroundColor: statusChartColors[status] }]}
                    />
                  )}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {selected && selectedCount > 0 && (
        <PressableScale haptic="select" onPress={() => onOpenStatus(selected)} style={styles.viewLink} accessibilityRole="link">
          <Text style={styles.viewLinkText}>View {STATUS_LABELS[selected].toLowerCase()} tickets</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </PressableScale>
      )}
    </Card>
  );
}

function barDescription(counts: Partial<Record<TicketStatus, number>>, total: number): string {
  const parts = STATUSES.filter((status) => (counts[status] ?? 0) > 0).map(
    (status) => `${STATUS_LABELS[status]} ${counts[status]}`,
  );
  return `${total} tickets this month: ${parts.join(', ')}`;
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.three,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.two,
    flexWrap: 'wrap',
  },
  headlineValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headlineLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  bar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
    // A 2px surface gap separates neighbouring segments.
    gap: 2,
  },
  emptyBar: {
    backgroundColor: colors.borderLight,
  },
  segment: {
    height: '100%',
    minWidth: 4,
  },
  faded: {
    opacity: 0.3,
  },
  legend: {
    gap: spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.two,
    borderRadius: 10,
  },
  rowSelected: {
    backgroundColor: colors.background,
  },
  rowPressed: {
    opacity: 0.7,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  rowBody: {
    flex: 1,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rowCount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowPercent: {
    width: 40,
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.one,
    paddingVertical: spacing.two,
  },
  viewLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
}));
