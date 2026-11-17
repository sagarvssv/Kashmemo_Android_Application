import { router } from 'expo-router';
import React from 'react';

import { Card, ListRow } from '@/components/card';

import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { AttentionChip } from '@/features/dashboard/overview-widgets';
import { useApi } from '@/hooks/use-api';
import { advanceApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';
import { can, canSettleAdvanceOf } from '@/lib/permissions';

// The advance work waiting for the signed-in user, for Home's attention list:
// bills to review (Manager / Finance Manager / CEO) and advances out or ready
// to settle (Finance Manager / CEO / HR). Each chip only shows when there is
// something to do, and only to roles allowed to do it.
export function useAdvanceAttention() {
  const user = useCurrentUser();
  const reviews = can.reviewAdvanceBills(user.role);
  const outstanding = can.viewOutstandingAdvances(user.role);
  const bills = useApi(() => (reviews ? advanceApi.pendingBills().then((r) => r.data) : Promise.resolve([])), [reviews]);
  const advances = useApi(
    () => (outstanding ? advanceApi.outstanding().then((r) => r.data) : Promise.resolve([])),
    [outstanding],
  );

  useRealtime(['ticket:created', 'ticket:status-update'], () => {
    void bills.reload();
    void advances.reload();
  });

  const refresh = async () => {
    await Promise.all([bills.refresh(), advances.refresh()]);
  };

  return { bills: bills.data ?? [], advances: advances.data ?? [], refresh };
}

export function AdvanceAttentionChips({ attention }: { attention: ReturnType<typeof useAdvanceAttention> }) {
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const { bills, advances } = attention;
  const billsTotal = bills.reduce((sum, bill) => sum + toAmount(bill.amount), 0);
  const toSettle = advances.filter((advance) => advance.status === 'SETTLEMENT_PENDING');
  // A Finance Manager's own advance is the CEO's to settle, never their own.
  const mineToSettle = toSettle.filter((advance) =>
    canSettleAdvanceOf(user.role, advance.employee?.role ?? 'EMPLOYEE', advance.raisedBy === user.userId),
  );
  const settleCount = mineToSettle.length > 0 ? mineToSettle.length : toSettle.length;
  const spending = advances.filter((advance) => advance.status === 'DISBURSED');
  const cashOut = spending.reduce((sum, advance) => sum + advance.toReturn, 0);

  return (
    <>
      {bills.length > 0 ? (
        <AttentionChip
          icon="receipt-outline"
          count={bills.length}
          label={bills.length === 1 ? 'bill on a cash request to review' : 'bills on cash requests to review'}
          detail={formatMoney(billsTotal)}
          href="/review-bills"
        />
      ) : null}
      {toSettle.length > 0 ? (
        <AttentionChip
          icon="checkmark-done-outline"
          count={settleCount}
          label={
            can.settleAdvance(user.role) && mineToSettle.length > 0
              ? settleCount === 1
                ? 'cash request ready for you to settle'
                : 'cash requests ready for you to settle'
              : settleCount === 1
                ? 'cash request waiting to settle'
                : 'cash requests waiting to settle'
          }
          href="/advances"
        />
      ) : null}
      {spending.length > 0 ? (
        <AttentionChip
          icon="wallet-outline"
          count={spending.length}
          label={spending.length === 1 ? 'cash request being spent' : 'cash requests being spent'}
          detail={cashOut > 0 ? `${formatMoney(cashOut)} out` : undefined}
          href="/advances"
        />
      ) : null}
    </>
  );
}

// Card of shortcuts for the CEO/HR Home (same layout as the iOS app): bills on
// cash requests to review, and cash requests with cash out. Hidden for roles
// that can do neither.
export function AdvanceShortcuts({ attention }: { attention: ReturnType<typeof useAdvanceAttention> }) {
  const user = useCurrentUser();
  const showBills = can.reviewAdvanceBills(user.role);
  const showAdvances = can.viewOutstandingAdvances(user.role);
  if (!showBills && !showAdvances) return null;
  const { bills, advances } = attention;
  const toSettle = advances.filter((advance) => advance.status === 'SETTLEMENT_PENDING').length;

  return (
    <Card style={{ gap: 0, paddingVertical: 4 }}>
      {showBills ? (
        <ListRow
          icon="receipt-outline"
          title="Bills to review"
          subtitle="Bills employees added to their cash requests"
          meta={String(bills.length)}
          onPress={() => router.push('/review-bills')}
        />
      ) : null}
      {showAdvances ? (
        <ListRow
          icon="swap-horizontal-outline"
          title="Cash requests out"
          subtitle={`${advances.length} with cash out · ${toSettle} ready to settle`}
          onPress={() => router.push('/advances')}
        />
      ) : null}
    </Card>
  );
}
