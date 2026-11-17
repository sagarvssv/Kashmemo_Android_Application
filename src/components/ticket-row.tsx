import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { StatusBadge } from '@/components/status-badge';
import { iconBadge, radius, spacing, typography } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { createStyles, useColors } from '@/context/theme';
import { formatDate, toAmount } from '@/lib/format';
import type { Money, TicketStatus } from '@/lib/types';

type TicketRowProps = {
  ticket: {
    id: string;
    purpose: string;
    amount: Money;
    // Cash requests: approved bills against the cash given.
    spentAmount?: Money;
    status: TicketStatus;
    createdAt?: string;
    approvedAt?: string | null;
    disbursedAt?: string | null;
    department?: { name: string };
    source?: 'MANUAL' | 'RECEIPT';
  };
};

// Once the cash is handed over, what was spent matters as much as what was given.
export const SPENDING_STATUSES: TicketStatus[] = ['DISBURSED', 'SETTLEMENT_PENDING', 'SETTLED'];

export function TicketRow({ ticket }: TicketRowProps) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const date = ticket.disbursedAt ?? ticket.approvedAt ?? ticket.createdAt;
  const showSpent = ticket.source !== 'RECEIPT' && SPENDING_STATUSES.includes(ticket.status);
  const spent = toAmount(ticket.spentAmount ?? 0);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Text style={styles.purpose} numberOfLines={2}>
          {ticket.purpose}
        </Text>
        <View style={styles.amounts}>
          <Text style={styles.amount}>{formatMoney(ticket.amount)}</Text>
          {showSpent ? (
            <Text style={[styles.spent, spent > toAmount(ticket.amount) && { color: colors.danger }]}>
              Spent {formatMoney(spent)}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.badges}>
          <StatusBadge status={ticket.status} />
          {ticket.source === 'RECEIPT' ? (
            <View style={styles.billTag} accessibilityLabel="Bill">
              <Ionicons name="receipt-outline" size={12} color={colors.primary} />
              <Text style={styles.billTagText}>Bill</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {[ticket.department?.name, formatDate(date)].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    padding: spacing.four,
    gap: spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  pressed: {
    opacity: 0.7,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.three,
  },
  purpose: {
    flex: 1,
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  amounts: {
    alignItems: 'flex-end',
    gap: 2,
  },
  spent: {
    ...typography.footnoteStrong,
    color: colors.textSecondary,
  },
  amount: {
    ...typography.bodyStrong,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.three,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: iconBadge(colors.primary),
  },
  billTagText: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  meta: {
    flexShrink: 1,
    ...typography.caption,
    color: colors.textMuted,
  },
}));
