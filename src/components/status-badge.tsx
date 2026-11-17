import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { typography } from '@/constants/theme';
import { useColors, useTheme } from '@/context/theme';
import { STATUS_LABELS } from '@/lib/format';
import type { TicketStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { statusColors, statusChartColors } = useTheme();
  const palette = statusColors[status] ?? statusColors.PENDING;
  return (
    <View style={[styles.badge, styles.statusBadge, { backgroundColor: palette.background }]}>
      <View style={[styles.dot, { backgroundColor: statusChartColors[status] ?? palette.text }]} />
      <Text style={[styles.label, { color: palette.text }]}>{STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

export function Tag({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
      <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    ...typography.captionStrong,
  },
});
