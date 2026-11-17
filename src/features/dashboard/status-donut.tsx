import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Card } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { spacing, typography } from '@/constants/theme';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { STATUS_LABELS } from '@/lib/format';
import type { TicketStatus } from '@/lib/types';

// Workflow order, so the ring reads clockwise from "waiting" to "done".
const STATUSES: TicketStatus[] = ['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'DISBURSED', 'SETTLEMENT_PENDING', 'SETTLED', 'REJECTED'];

const SIZE = 156;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// A hairline gap between segments so neighbouring colours stay apart.
const GAP = 2;

type StatusDonutProps = {
  // Inside the card; leave out when a Section heading names it.
  title?: string;
  counts: Partial<Record<TicketStatus, number>>;
  onOpenStatus: (status: TicketStatus) => void;
};

function percent(part: number, total: number): string {
  if (!total) return '0%';
  const value = (part / total) * 100;
  return `${value > 0 && value < 1 ? '<1' : Math.round(value)}%`;
}

// The month's bills by status as a ring with the total in the middle, and a
// compact legend beside it. Each legend row opens the bills with that status.
// Much shorter than a bar chart with a full legend, so Home needs no scrolling.
export function StatusDonut({ title, counts, onOpenStatus }: StatusDonutProps) {
  const styles = useStyles();
  const colors = useColors();
  const { statusChartColors } = useTheme();
  const total = STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  const shown = STATUSES.filter((status) => (counts[status] ?? 0) > 0);
  const gap = shown.length > 1 ? GAP : 0;

  // Each segment starts where the ones before it end.
  const lengths = shown.map((status) => ((counts[status] ?? 0) / total) * CIRCUMFERENCE);
  const segments = shown.map((status, index) => ({
    status,
    length: Math.max(lengths[index] - gap, 0.5),
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }));

  return (
    <Card style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.body}>
        <View
          style={styles.ring}
          accessibilityRole="image"
          accessibilityLabel={`${total} bills: ${shown.map((status) => `${STATUS_LABELS[status]} ${counts[status]}`).join(', ')}`}>
          <Svg width={SIZE} height={SIZE}>
            {/* Start at 12 o'clock and go clockwise. */}
            <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={colors.borderLight}
                strokeWidth={STROKE}
                fill="none"
              />
              {segments.map((segment) => (
                <Circle
                  key={segment.status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={statusChartColors[segment.status]}
                  strokeWidth={STROKE}
                  strokeDasharray={`${segment.length} ${CIRCUMFERENCE - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  fill="none"
                />
              ))}
            </G>
          </Svg>
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.total}>{total}</Text>
            <Text style={styles.totalLabel}>{total === 1 ? 'bill' : 'bills'}</Text>
          </View>
        </View>

        <View style={styles.legend}>
          {shown.length === 0 ? <Text style={styles.empty}>No bills raised this month.</Text> : null}
          {shown.map((status) => {
            const count = counts[status] ?? 0;
            return (
              <PressableScale
                key={status}
                haptic="tap"
                onPress={() => onOpenStatus(status)}
                accessibilityRole="button"
                accessibilityLabel={`${STATUS_LABELS[status]}: ${count} bills, ${percent(count, total)}. Open the list`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={[styles.dot, { backgroundColor: statusChartColors[status] }]} />
                <Text style={styles.label} numberOfLines={1}>
                  {STATUS_LABELS[status]}
                </Text>
                <Text style={styles.count}>{count}</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
              </PressableScale>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.two,
    padding: spacing.three,
  },
  title: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
  },
  ring: {
    width: SIZE,
    height: SIZE,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  total: {
    ...typography.display,
    color: colors.textPrimary,
  },
  totalLabel: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  legend: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    paddingVertical: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  label: {
    flex: 1,
    ...typography.callout,
    color: colors.textSecondary,
  },
  count: {
    ...typography.calloutStrong,
    color: colors.textPrimary,
  },
  empty: {
    ...typography.callout,
    color: colors.textMuted,
  },
}));
