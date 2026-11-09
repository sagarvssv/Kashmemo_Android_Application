import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { spacing } from '@/constants/theme';
import { createStyles, useTheme } from '@/context/theme';
import type { InvoiceStatus } from '@/lib/invoices';
import type { TicketStatus } from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

// Plain words for each bill status. Colours reuse the ticket status colours so
// "waiting", "done" and "problem" look the same across the app.
export const BILL_STATUS: Record<InvoiceStatus, { label: string; icon: IconName; tone: TicketStatus }> = {
  UPLOAD_PENDING: { label: 'Reading', icon: 'hourglass-outline', tone: 'PENDING' },
  PROCESSING: { label: 'Reading', icon: 'hourglass-outline', tone: 'PENDING' },
  COMPLETED: { label: 'Not sent yet', icon: 'eye-outline', tone: 'PARTIALLY_APPROVED' },
  // Checked by the user; sending it for approval makes a ticket (see bill-tickets.ts).
  CONFIRMED: { label: 'Checked', icon: 'checkmark-circle', tone: 'APPROVED' },
  DUPLICATE: { label: 'Already used', icon: 'copy-outline', tone: 'REJECTED' },
  FAILED: { label: 'Could not read', icon: 'alert-circle-outline', tone: 'REJECTED' },
};

export function BillStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles = useStyles();
  const { statusColors } = useTheme();
  const info = BILL_STATUS[status];
  const tone = statusColors[info.tone];
  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Ionicons name={info.icon} size={13} color={tone.text} />
      <Text style={[styles.badgeText, { color: tone.text }]}>{info.label}</Text>
    </View>
  );
}

const useStyles = createStyles(() => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.one,
    paddingHorizontal: spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
}));
