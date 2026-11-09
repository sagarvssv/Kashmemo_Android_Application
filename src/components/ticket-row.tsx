import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { StatusBadge } from '@/components/status-badge';
import { radius, spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { createStyles, useColors } from '@/context/theme';
import { formatDate } from '@/lib/format';
import type { Money, TicketStatus } from '@/lib/types';

type TicketRowProps = {
  ticket: {
    id: string;
    purpose: string;
    amount: Money;
    status: TicketStatus;
    createdAt?: string;
    approvedAt?: string | null;
    disbursedAt?: string | null;
    department?: { name: string };
    source?: 'MANUAL' | 'RECEIPT';
  };
};

export function TicketRow({ ticket }: TicketRowProps) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const date = ticket.disbursedAt ?? ticket.approvedAt ?? ticket.createdAt;
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Text style={styles.purpose} numberOfLines={2}>
          {ticket.purpose}
        </Text>
        <Text style={styles.amount}>{formatMoney(ticket.amount)}</Text>
      </View>
      <View style={styles.bottom}>
        <View style={styles.badges}>
          <StatusBadge status={ticket.status} />
          {ticket.source === 'RECEIPT' ? (
            <View style={styles.billTag} accessibilityLabel="Claim">
              <Ionicons name="receipt-outline" size={12} color={colors.primary} />
              <Text style={styles.billTagText}>Claim</Text>
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  amount: {
    fontSize: 15,
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
    gap: spacing.two,
  },
  billTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.two,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  billTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
}));
