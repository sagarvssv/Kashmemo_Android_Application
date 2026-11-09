import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card, Section } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { ErrorState, InlineError, LoadingState } from '@/components/states';
import { categoryLabel } from '@/constants/expense-categories';
import { radius, spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { advanceApi } from '@/lib/endpoints';
import { formatDate, toAmount } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { invoiceApi, invoiceApiEnabled } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import type { AdvanceBill, Ticket } from '@/lib/types';

import { AdvanceMoney, BillStatusPill, WalletTxnRow } from './advance-ui';

// An advance after its cash was handed over: the money, the bills added
// against it, and the next step for whoever is looking:
//   employee (DISBURSED)            → add bills, or "I'm done" (send for settlement)
//   Manager / FM / CEO              → approve or reject each waiting bill
//   Finance Manager (SETTLEMENT_PENDING) → settle: collect what's left / pay the overspend
export function AdvancePanel({
  ticket,
  raiserName,
  onChanged,
}: {
  ticket: Ticket;
  raiserName?: string;
  // Called after anything here changed the ticket, so the screen reloads it.
  onChanged: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const details = useApi(() => advanceApi.details(ticket.id).then((r) => r.data), [ticket.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdvanceBill | null>(null);

  useRealtime(['ticket:status-update'], (payload) => {
    const updated = (payload as { ticket?: Ticket } | undefined)?.ticket;
    if (updated?.id === ticket.id) void details.reload();
  });

  const isMine = ticket.raisedBy === user.userId;
  const open = ticket.status === 'DISBURSED' || ticket.status === 'SETTLEMENT_PENDING';
  const canReview = !isMine && open && can.reviewAdvanceBills(user.role);
  const canSettle = !isMine && ticket.status === 'SETTLEMENT_PENDING' && can.settleAdvance(user.role);

  const data = details.data;
  const bills = data?.bills ?? [];
  const pendingBills = bills.filter((bill) => bill.status === 'PENDING').length;
  // + cash still with the employee, - what finance owes them.
  const balance = data?.balance ?? 0;
  const who = isMine ? 'you' : (raiserName ?? 'the employee');

  const run = async (key: string, action: () => Promise<unknown>, done?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      haptics.success();
      await details.reload();
      onChanged();
      done?.();
    } catch (err) {
      haptics.error();
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // The employee is done spending: confirm what happens next, then send it.
  const handleRequestSettlement = () => {
    const outcome =
      balance > 0
        ? `You will give back ${formatMoney(balance)} of unspent cash to finance.`
        : balance < 0
          ? `Finance will pay you ${formatMoney(-balance)} that you spent over the advance.`
          : 'The advance is fully spent, so no cash changes hands.';
    const warning = pendingBills
      ? `\n\n${pendingBills === 1 ? '1 bill is' : `${pendingBills} bills are`} still waiting for approval. You can't add more bills after this.`
      : "\n\nYou can't add more bills after this.";
    Alert.alert('Finished spending?', outcome + warning, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Yes, I finished', onPress: () => void run('settlement', () => advanceApi.requestSettlement(ticket.id)) },
    ]);
  };

  // Finance hands over or takes back the difference, then closes the advance.
  const handleSettle = () => {
    const name = raiserName ?? 'the employee';
    const step =
      balance > 0
        ? `Collect ${formatMoney(balance)} of unspent cash from ${name}.`
        : balance < 0
          ? `Pay ${formatMoney(-balance)} to ${name} for the overspend.`
          : 'Nothing to collect or pay. This closes the advance.';
    Alert.alert('Settle this advance?', `${step}\n\nOnly settle after the cash has changed hands.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: () => void run('settle', () => advanceApi.settle(ticket.id)) },
    ]);
  };

  // The bill's file link expires after 5 minutes, so fetch a fresh one.
  const openBillFile = async (bill: AdvanceBill) => {
    setBusy(`file:${bill.id}`);
    setError(null);
    try {
      const invoice = await invoiceApi.get(bill.invoiceId);
      if (!invoice.fileUrl) throw new Error('The bill file is not available.');
      haptics.tap();
      await WebBrowser.openBrowserAsync(invoice.fileUrl);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (details.isLoading && !data) return <LoadingState rows={2} />;
  if (details.error && !data) return <ErrorState message={details.error} onRetry={details.reload} />;
  if (!data) return null;

  const settled = toAmount(data.settlementBalanceAmount ?? 0);

  return (
    <>
      <Section title="Advance money">
        <Card>
          <AdvanceMoney amount={data.amount} spentAmount={data.spentAmount ?? 0} pendingBills={pendingBills} />

          {/* What happens with the difference, in one sentence. */}
          <View style={[styles.outcome, { backgroundColor: colors.primarySoft }]}>
            <Text style={styles.outcomeText}>
              {ticket.status === 'SETTLED'
                ? settled > 0
                  ? `Settled: ${formatMoney(settled)} of unspent cash was returned.`
                  : settled < 0
                    ? `Settled: finance paid ${formatMoney(-settled)} for the overspend.`
                    : 'Settled: the advance was fully spent.'
                : balance > 0
                  ? isMine
                    ? `${formatMoney(balance)} of this cash is not covered by approved bills yet.`
                    : `${who} has ${formatMoney(balance)} of advance cash not yet backed by approved bills.`
                  : balance < 0
                    ? `Finance owes ${who} ${formatMoney(-balance)} for spending over the advance.`
                    : isMine
                      ? 'Your approved bills cover all of this cash.'
                      : 'Every bit of this advance is backed by approved bills.'}
            </Text>
            {isMine && ticket.status === 'DISBURSED' ? (
              <Text style={styles.outcomeHint}>
                Each time you buy something, tap Add a bill. When you finish, tap I finished spending
                {balance > 0 ? ' and give back the cash that is left.' : '.'}
              </Text>
            ) : null}
            {ticket.status === 'SETTLEMENT_PENDING' ? (
              <Text style={styles.outcomeHint}>
                {isMine
                  ? balance > 0
                    ? `Give ${formatMoney(balance)} back to finance. Then they close the advance.`
                    : balance < 0
                      ? `Finance will pay you ${formatMoney(-balance)}, then close the advance.`
                      : 'Waiting for finance to close the advance.'
                  : 'Sent for settlement.'}
              </Text>
            ) : null}
          </View>

          {isMine && ticket.status === 'DISBURSED' ? (
            <View style={styles.actionsColumn}>
              {invoiceApiEnabled ? (
                <PrimaryButton
                  label="Add a bill"
                  icon="camera"
                  onPress={() => router.push({ pathname: '/upload-bill', params: { advanceId: ticket.id } })}
                />
              ) : null}
              <PrimaryButton
                label="I finished spending"
                icon="checkmark-done-outline"
                variant="secondary"
                onPress={handleRequestSettlement}
                loading={busy === 'settlement'}
              />
            </View>
          ) : null}

          {canSettle ? (
            <View style={styles.actionsColumn}>
              {pendingBills ? (
                <Text style={styles.hint}>
                  Approve or reject the {pendingBills === 1 ? 'waiting bill' : `${pendingBills} waiting bills`} first.
                </Text>
              ) : null}
              <PrimaryButton
                label={
                  balance > 0
                    ? `Settle · collect ${formatMoney(balance)}`
                    : balance < 0
                      ? `Settle · pay ${formatMoney(-balance)}`
                      : 'Settle · close the advance'
                }
                icon="checkmark-done-outline"
                onPress={handleSettle}
                disabled={pendingBills > 0}
                loading={busy === 'settle'}
              />
            </View>
          ) : null}

          <InlineError message={error} />
        </Card>
      </Section>

      <Section title={bills.length ? `Bills for this advance (${bills.length})` : 'Bills for this advance'}>
        {bills.length === 0 ? (
          <Card>
            <Text style={styles.hint}>
              {isMine
                ? 'No bills yet. Each time you buy something with this cash, tap Add a bill and take a photo of the bill.'
                : 'No bills added yet.'}
            </Text>
          </Card>
        ) : (
          <View style={styles.bills}>
            {bills.map((bill) => (
              <Card key={bill.id}>
                <View style={styles.billHeader}>
                  <View style={styles.billText}>
                    <Text style={styles.billTitle} numberOfLines={1}>
                      {bill.vendorName || categoryLabel(bill.category)}
                    </Text>
                    <Text style={styles.hint}>
                      {[bill.vendorName ? categoryLabel(bill.category) : null, bill.invoiceDate ? formatDate(bill.invoiceDate) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.billAmount}>{formatMoney(bill.amount)}</Text>
                </View>
                <BillStatusPill status={bill.status} />
                {bill.status === 'REJECTED' && bill.rejectionReason ? (
                  <Text style={styles.reason}>Reason: {bill.rejectionReason}</Text>
                ) : null}
                <View style={styles.billActions}>
                  {invoiceApiEnabled ? (
                    <PressableScale
                      haptic="tap"
                      onPress={() => void openBillFile(bill)}
                      accessibilityRole="button"
                      accessibilityLabel="View the bill"
                      style={styles.link}>
                      <Text style={styles.linkText}>{busy === `file:${bill.id}` ? 'Opening…' : 'View the bill'}</Text>
                    </PressableScale>
                  ) : null}
                </View>
                {canReview && bill.status === 'PENDING' ? (
                  <View style={styles.actionsRow}>
                    <PrimaryButton
                      label="Reject"
                      variant="secondary"
                      onPress={() => setRejecting(bill)}
                      style={styles.flex}
                    />
                    <PrimaryButton
                      label="Approve"
                      onPress={() => void run(`approve:${bill.id}`, () => advanceApi.approveBill(bill.id))}
                      loading={busy === `approve:${bill.id}`}
                      style={styles.flex}
                    />
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </Section>

      {data.walletTransactions.length > 0 ? (
        <Section title="Money history">
          <Card style={styles.history}>
            {data.walletTransactions.map((txn) => (
              <WalletTxnRow key={txn.id} txn={txn} />
            ))}
          </Card>
        </Section>
      ) : null}

      <PromptModal
        visible={rejecting !== null}
        title="Reject bill"
        message="The employee will see your reason. A rejected bill doesn't count as spent."
        fields={[{ key: 'reason', label: 'Reason', placeholder: 'Why is this bill rejected?', multiline: true }]}
        confirmLabel="Reject"
        destructive
        onClose={() => setRejecting(null)}
        onSubmit={async ({ reason }) => {
          if (!rejecting) return;
          if (reason.trim().length < 3) throw new Error('Please write a reason (at least 3 letters).');
          await advanceApi.rejectBill(rejecting.id, reason.trim());
          haptics.warning();
          await details.reload();
          onChanged();
        }}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  flex: {
    flex: 1,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  outcome: {
    gap: spacing.one,
    padding: spacing.three,
    borderRadius: radius.medium,
  },
  outcomeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  outcomeHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionsColumn: {
    gap: spacing.two,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  bills: {
    gap: spacing.three,
  },
  billHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.three,
  },
  billText: {
    flex: 1,
    gap: 2,
  },
  billTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  billAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  reason: {
    fontSize: 13,
    color: colors.danger,
  },
  billActions: {
    flexDirection: 'row',
  },
  link: {
    minHeight: 32,
    justifyContent: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  history: {
    gap: 0,
    paddingVertical: spacing.two,
  },
}));
