import React from 'react';

import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { AttentionChip } from '@/features/dashboard/overview-widgets';
import { useApi } from '@/hooks/use-api';
import { advanceApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';
import { can } from '@/lib/permissions';

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
  const spending = advances.filter((advance) => advance.status === 'DISBURSED');
  const cashOut = spending.reduce((sum, advance) => sum + advance.toReturn, 0);

  return (
    <>
      {bills.length > 0 ? (
        <AttentionChip
          icon="receipt-outline"
          count={bills.length}
          label={bills.length === 1 ? 'bill on an advance to review' : 'bills on advances to review'}
          detail={formatMoney(billsTotal)}
          href="/review-bills"
        />
      ) : null}
      {toSettle.length > 0 ? (
        <AttentionChip
          icon="checkmark-done-outline"
          count={toSettle.length}
          label={
            can.settleAdvance(user.role)
              ? toSettle.length === 1
                ? 'advance ready for you to settle'
                : 'advances ready for you to settle'
              : toSettle.length === 1
                ? 'advance waiting to settle'
                : 'advances waiting to settle'
          }
          href="/advances"
        />
      ) : null}
      {spending.length > 0 ? (
        <AttentionChip
          icon="wallet-outline"
          count={spending.length}
          label={spending.length === 1 ? 'advance being spent' : 'advances being spent'}
          detail={cashOut > 0 ? `${formatMoney(cashOut)} out` : undefined}
          href="/advances"
        />
      ) : null}
    </>
  );
}
