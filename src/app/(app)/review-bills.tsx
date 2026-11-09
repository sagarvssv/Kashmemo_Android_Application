import { Redirect, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Appear, PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/states';
import { categoryLabel } from '@/constants/expense-categories';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { advanceApi } from '@/lib/endpoints';
import { formatDate, toAmount } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { invoiceApi, invoiceApiEnabled } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import type { PendingAdvanceBill } from '@/lib/types';

// Bills employees added to their advances, waiting for review (oldest
// first). A Manager sees their departments; the Finance Manager and CEO see
// all. Approving debits the bill from the employee's wallet.
export default function ReviewBillsRoute() {
  const user = useCurrentUser();
  if (!can.reviewAdvanceBills(user.role)) return <Redirect href="/home" />;
  return <ReviewBillsScreen />;
}

function ReviewBillsScreen() {
  const styles = useStyles();
  const bills = useApi(() => advanceApi.pendingBills().then((r) => r.data), []);
  const [rejecting, setRejecting] = useState<PendingAdvanceBill | null>(null);

  useRealtime(['ticket:status-update', 'ticket:created'], () => {
    void bills.reload();
  });

  // Reviewed bills leave the list straight away.
  const remove = (billId: string) => bills.setData((current) => current?.filter((bill) => bill.id !== billId));

  const list = bills.data ?? [];

  return (
    <Screen title="Bills to review" subtitle="Bills added to advances" backFallback="/home" scroll={false}>
      {bills.isLoading && !bills.data ? (
        <LoadingState />
      ) : bills.error && !bills.data ? (
        <ErrorState message={bills.error} onRetry={bills.reload} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(bill) => bill.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={bills.isRefreshing} onRefresh={bills.refresh} />}
          ListHeaderComponent={
            list.length ? (
              <Text style={styles.hint}>
                {list.length === 1 ? '1 bill is' : `${list.length} bills are`} waiting. Approving a bill counts it as
                spent from the advance.
              </Text>
            ) : undefined
          }
          ListEmptyComponent={<EmptyState icon="checkmark-done-outline" title="All caught up. No bills to review." />}
          renderItem={({ item, index }) => (
            <Appear index={Math.min(index, 8)}>
              <BillReviewCard bill={item} onReviewed={() => remove(item.id)} onReject={() => setRejecting(item)} />
            </Appear>
          )}
        />
      )}

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
          remove(rejecting.id);
        }}
      />
    </Screen>
  );
}

function BillReviewCard({
  bill,
  onReviewed,
  onReject,
}: {
  bill: PendingAdvanceBill;
  onReviewed: () => void;
  onReject: () => void;
}) {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const [busy, setBusy] = useState<'approve' | 'file' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const given = toAmount(bill.ticket.amount);
  const spent = toAmount(bill.ticket.spentAmount);
  const leftAfter = given - spent - toAmount(bill.amount);

  const approve = async () => {
    setBusy('approve');
    setError(null);
    try {
      await advanceApi.approveBill(bill.id);
      haptics.success();
      onReviewed();
    } catch (err) {
      haptics.error();
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // The bill's file link expires after 5 minutes, so fetch a fresh one.
  const openFile = async () => {
    setBusy('file');
    setError(null);
    try {
      const invoice = await invoiceApi.get(bill.invoiceId);
      if (!invoice.fileUrl) throw new Error('The bill file is not available.');
      await WebBrowser.openBrowserAsync(invoice.fileUrl);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {bill.vendorName || categoryLabel(bill.category)}
          </Text>
          <Text style={styles.hint}>
            {[bill.vendorName ? categoryLabel(bill.category) : null, bill.invoiceDate ? formatDate(bill.invoiceDate) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(bill.amount)}</Text>
      </View>

      <PressableScale
        haptic="tap"
        onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: bill.ticket.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Open the advance ${bill.ticket.purpose}`}
        style={styles.advance}>
        <Text style={styles.advanceLabel}>On advance · {bill.ticket.department.name}</Text>
        <Text style={styles.advanceTitle} numberOfLines={1}>
          {bill.ticket.purpose}
        </Text>
        <Text style={styles.hint}>
          Given {formatMoney(given)} · approved so far {formatMoney(spent)} ·{' '}
          {leftAfter >= 0 ? `${formatMoney(leftAfter)} left after this bill` : `${formatMoney(-leftAfter)} over after this bill`}
        </Text>
      </PressableScale>

      {invoiceApiEnabled ? (
        <PressableScale haptic="tap" onPress={() => void openFile()} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>{busy === 'file' ? 'Opening…' : 'View the bill'}</Text>
        </PressableScale>
      ) : null}

      <InlineError message={error} />

      <View style={styles.actions}>
        <PrimaryButton label="Reject" variant="secondary" onPress={onReject} style={styles.flex} />
        <PrimaryButton label="Approve" onPress={() => void approve()} loading={busy === 'approve'} style={styles.flex} />
      </View>
    </Card>
  );
}

const useStyles = createStyles((colors) => ({
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
    gap: spacing.three,
    flexGrow: 1,
  },
  separator: {
    height: spacing.three,
  },
  flex: {
    flex: 1,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  advance: {
    gap: 2,
    padding: spacing.three,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  advanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  advanceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  link: {
    minHeight: 32,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
}));
