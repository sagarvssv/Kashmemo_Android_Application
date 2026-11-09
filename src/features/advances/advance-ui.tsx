import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { ProgressBar } from '@/components/stat-tile';
import { StatusBadge } from '@/components/status-badge';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { formatDate, toAmount } from '@/lib/format';
import type { BillStatus, Money, TicketStatus, WalletTransaction, WalletTxnType } from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

// Shared pieces for advances: the money summary, a tappable advance card,
// wallet history rows and bill-status badges.

// What happened to the money, in plain words. Amounts are signed: + cash went
// to the employee, - cash was accounted for.
export const WALLET_TXN: Record<WalletTxnType, { label: string; icon: IconName }> = {
  ADVANCE_CREDIT: { label: 'Advance cash received', icon: 'arrow-down-circle' },
  BILL_DEBIT: { label: 'Bill approved', icon: 'receipt' },
  CASH_RETURNED: { label: 'Unspent cash returned', icon: 'arrow-up-circle' },
  OVERSPEND_PAID: { label: 'Overspend paid to you', icon: 'cash' },
};

export const BILL_STATUS_TEXT: Record<BillStatus, { label: string; tone: TicketStatus }> = {
  PENDING: { label: 'Waiting for approval', tone: 'PENDING' },
  APPROVED: { label: 'Approved', tone: 'APPROVED' },
  REJECTED: { label: 'Rejected', tone: 'REJECTED' },
};

export function BillStatusPill({ status }: { status: BillStatus }) {
  const styles = useStyles();
  const { statusColors } = useTheme();
  const info = BILL_STATUS_TEXT[status];
  const tone = statusColors[info.tone];
  return (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <Text style={[styles.pillText, { color: tone.text }]}>{info.label}</Text>
    </View>
  );
}

// Given · spent · left (or overspent) with a bar. `pendingBills` counts bills
// not approved yet, which don't count as spent.
export function AdvanceMoney({
  amount,
  spentAmount,
  pendingBills,
}: {
  amount: Money;
  spentAmount: Money;
  pendingBills?: number;
}) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const given = toAmount(amount);
  const spent = toAmount(spentAmount);
  const left = given - spent;
  return (
    <View style={styles.money}>
      <View style={styles.moneyRow}>
        <Figure label="Given" value={formatMoney(given)} />
        <Figure label="Spent" value={formatMoney(spent)} />
        <Figure
          label={left >= 0 ? 'Left' : 'Overspent'}
          value={formatMoney(Math.abs(left))}
          color={left >= 0 ? colors.success : colors.danger}
        />
      </View>
      <ProgressBar value={spent} max={given} />
      {pendingBills ? (
        <Text style={styles.hint}>
          {pendingBills === 1 ? '1 bill is' : `${pendingBills} bills are`} waiting for approval and not counted yet.
        </Text>
      ) : null}
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

// One open advance; opens the ticket, where bills are added and it is settled.
export function AdvanceCard({
  id,
  purpose,
  amount,
  spentAmount,
  status,
  subtitle,
  pendingBills,
  footer,
}: {
  id: string;
  purpose: string;
  amount: Money;
  spentAmount: Money;
  status: TicketStatus;
  subtitle?: string;
  pendingBills?: number;
  footer?: React.ReactNode;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push({ pathname: '/ticket/[id]', params: { id } })}
      accessibilityRole="button"
      accessibilityLabel={`Advance ${purpose}`}>
      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBox}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {purpose}
            </Text>
            {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        <StatusBadge status={status} />
        <AdvanceMoney amount={amount} spentAmount={spentAmount} pendingBills={pendingBills} />
        {footer}
      </Card>
    </PressableScale>
  );
}

export function WalletTxnRow({ txn, onPress }: { txn: WalletTransaction; onPress?: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const value = toAmount(txn.amount);
  const info = WALLET_TXN[txn.type];
  const content = (
    <View style={styles.txn}>
      <View style={styles.txnIcon}>
        <Ionicons name={info.icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.cardTitleBox}>
        <Text style={styles.txnLabel}>{info.label}</Text>
        <Text style={styles.hint}>{formatDate(txn.createdAt)}</Text>
      </View>
      <Text style={[styles.txnAmount, { color: value >= 0 ? colors.success : colors.textPrimary }]}>
        {value >= 0 ? '+' : '−'}
        {formatMoney(Math.abs(value))}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale haptic="tap" onPress={onPress} accessibilityRole="button" accessibilityLabel={info.label}>
      {content}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  money: {
    gap: spacing.two,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  figure: {
    flex: 1,
    gap: 2,
  },
  figureLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  figureValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.two,
  },
  cardTitleBox: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: spacing.two,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  txnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
}));
