import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Appear, PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { categoryLabel } from '@/constants/expense-categories';
import { radius, spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser } from '@/context/session';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { StatusBadge } from '@/components/status-badge';
import { BILL_STATUS, BillStatusBadge } from '@/features/bills/bill-status';
import { useBillTickets } from '@/features/bills/bill-tickets';
import { useCursorList } from '@/hooks/use-api';
import { LOCALE } from '@/lib/config';
import { formatDate, STATUS_LABELS, toAmount } from '@/lib/format';
import { invoiceApi, invoiceApiEnabled, type InvoiceSummary } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import type { Ticket, TicketStatus } from '@/lib/types';

const PAGE_SIZE = 20;

type IconName = keyof typeof Ionicons.glyphMap;

type Stage = 'sent' | 'finish' | 'problem';

// The bill's own ticket, once sent for approval.
type Claim = { ticket?: Ticket };

// Where a bill is, from the user's point of view: sent for approval, still
// needing them (being read, not checked, or checked but not sent), or stuck.
function stageOf(bill: InvoiceSummary, { ticket }: Claim): Stage {
  if (ticket) return ticket.status === 'REJECTED' ? 'problem' : 'sent';
  if (bill.status === 'FAILED' || bill.status === 'DUPLICATE') return 'problem';
  return 'finish';
}

// Three boxes summing up the bills shown.
const SUMMARY: { label: string; icon: IconName; tone: TicketStatus; stage: Stage }[] = [
  { label: 'Sent', icon: 'paper-plane-outline', tone: 'APPROVED', stage: 'sent' },
  { label: 'To finish', icon: 'hourglass-outline', tone: 'PENDING', stage: 'finish' },
  { label: 'Problem', icon: 'alert-circle-outline', tone: 'REJECTED', stage: 'problem' },
];

// Bills the user paid with their own money, to get it back, newest first. A
// tab for employees (see can.billsTab); other roles reach it from Home or More.
// Bills paid with advance cash live on their advance instead, so each bill is
// in exactly one place; a link at the top points there.
export default function BillsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const user = useCurrentUser();
  const isTab = can.billsTab(user.role);
  const billTickets = useBillTickets();
  const claimOf = (invoiceId: string): Claim => ({ ticket: billTickets.byInvoice.get(invoiceId) });
  const bills = useCursorList<InvoiceSummary>(
    (cursor) =>
      invoiceApiEnabled
        ? invoiceApi
            .list({ uploadedBy: user.userId, limit: PAGE_SIZE, nextToken: cursor })
            .then((page) => ({ data: page.items, nextCursor: page.nextToken }))
        : Promise.resolve({ data: [], nextCursor: null }),
    [user.userId],
  );
  const ownBills = bills.items.filter((bill) => !billTickets.onAdvance.has(bill.invoiceId));
  const onAdvanceCount = bills.items.length - ownBills.length;

  return (
    <Screen
      title="My claims"
      subtitle="Paid with your own money? Get it back"
      backFallback={isTab ? undefined : '/home'}
      scroll={false}>
      {!invoiceApiEnabled ? (
        <ErrorState message="Bill upload is not set up yet. Please ask your admin." />
      ) : bills.isLoading ? (
        <LoadingState />
      ) : bills.error && bills.items.length === 0 ? (
        <ErrorState message={bills.error} onRetry={bills.reload} />
      ) : (
        <FlatList
          data={ownBills}
          keyExtractor={(item) => item.invoiceId}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={bills.isRefreshing}
              onRefresh={() => void Promise.all([bills.refresh(), billTickets.refresh()])}
            />
          }
          ListHeaderComponent={
            <Header bills={ownBills} hasMore={bills.hasMore} claimOf={claimOf} onAdvanceCount={onAdvanceCount} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No claims yet"
              message="Spent your own money for work? Take a photo of the bill and get the money back."
            />
          }
          ListFooterComponent={
            bills.hasMore ? (
              bills.isLoadingMore ? (
                <ActivityIndicator style={styles.more} color={colors.primary} />
              ) : (
                <PrimaryButton
                  label="Show older claims"
                  variant="secondary"
                  onPress={() => void bills.loadMore()}
                  style={styles.more}
                />
              )
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <Appear index={Math.min(index, 8)}>
              <BillRow bill={item} claim={claimOf(item.invoiceId)} />
            </Appear>
          )}
        />
      )}
    </Screen>
  );
}

// The upload button, a summary of the bills and the money sent so far.
function Header({
  bills,
  hasMore,
  claimOf,
  onAdvanceCount,
}: {
  bills: InvoiceSummary[];
  hasMore: boolean;
  claimOf: (invoiceId: string) => Claim;
  // Bills paid with advance cash, shown on their advance rather than here.
  onAdvanceCount: number;
}) {
  const styles = useStyles();
  const colors = useColors();
  const { statusColors } = useTheme();
  const formatMoney = useFormatMoney();
  // Sent amounts are already in the app's currency (the backend converts).
  const sentTotal = bills.reduce((sum, bill) => {
    const { ticket } = claimOf(bill.invoiceId);
    return ticket && ticket.status !== 'REJECTED' ? sum + toAmount(ticket.amount) : sum;
  }, 0);

  return (
    <View style={styles.header}>
      <PressableScale
        haptic="tap"
        onPress={() => router.push('/upload-bill')}
        accessibilityRole="button"
        accessibilityLabel="New claim. Take a photo of the bill"
        style={styles.upload}>
        <View style={styles.uploadIcon}>
          <Ionicons name="camera" size={30} color={colors.primary} />
        </View>
        <View style={styles.uploadText}>
          <Text style={styles.uploadTitle}>New claim</Text>
          <Text style={styles.uploadHint}>Take a photo of the bill</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
      </PressableScale>

      {onAdvanceCount > 0 ? (
        <PressableScale
          haptic="tap"
          onPress={() => router.push('/tickets')}
          accessibilityRole="button"
          accessibilityLabel={`${onAdvanceCount} bills paid with advance cash are on your advances. Open Advances`}
          style={styles.advanceLink}>
          <Ionicons name="cash-outline" size={22} color={colors.primary} />
          <Text style={styles.advanceLinkText}>
            {onAdvanceCount === 1
              ? '1 bill was paid with advance cash. See it in Advances.'
              : `${onAdvanceCount} bills were paid with advance cash. See them in Advances.`}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </PressableScale>
      ) : null}

      {bills.length > 0 ? (
        <>
          <View style={styles.summary}>
            {SUMMARY.map((box) => {
              const count = bills.filter((bill) => stageOf(bill, claimOf(bill.invoiceId)) === box.stage).length;
              const tone = statusColors[box.tone];
              return (
                <View
                  key={box.label}
                  style={[styles.summaryBox, { backgroundColor: tone.background }]}
                  accessible
                  accessibilityLabel={`${box.label}: ${count}`}>
                  <Ionicons name={box.icon} size={20} color={tone.text} />
                  <Text style={[styles.summaryValue, { color: tone.text }]}>
                    {count}
                    {hasMore && count > 0 ? '+' : ''}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: tone.text }]}>{box.label}</Text>
                </View>
              );
            })}
          </View>
          {sentTotal > 0 ? (
            <Text style={styles.total}>Sent to get back: {formatMoney(sentTotal)}</Text>
          ) : null}
          <Text style={styles.sectionTitle}>{hasMore ? 'Latest claims' : 'All claims'}</Text>
        </>
      ) : null}
    </View>
  );
}

// What the user should do next with a bill, if anything.
function nextStep(bill: InvoiceSummary, { ticket }: Claim): string | undefined {
  if (ticket) return undefined;
  if (bill.status === 'COMPLETED') return 'Tap to check and send';
  if (bill.status === 'CONFIRMED') return 'Tap to send for approval';
  if (bill.status === 'FAILED') return 'Tap to try again';
  return undefined;
}

function BillRow({ bill, claim }: { bill: InvoiceSummary; claim: Claim }) {
  const styles = useStyles();
  const colors = useColors();
  const { statusColors } = useTheme();
  const { ticket } = claim;
  const when = bill.invoiceDate ?? bill.uploadedAt;
  const next = nextStep(bill, claim);
  return (
    <PressableScale
      haptic="tap"
      onPress={() =>
        bill.status === 'COMPLETED'
          ? router.push({ pathname: '/upload-bill', params: { invoiceId: bill.invoiceId } })
          : router.push({ pathname: '/bill/[id]', params: { id: bill.invoiceId } })
      }
      accessibilityRole="button"
      accessibilityLabel={[
        bill.vendorName ?? 'Bill',
        ticket ? STATUS_LABELS[ticket.status] : BILL_STATUS[bill.status].label,
        next,
      ]
        .filter(Boolean)
        .join('. ')}
      style={[styles.row, next && { borderColor: statusColors[BILL_STATUS[bill.status].tone].text }]}>
      <View style={styles.icon}>
        <Ionicons name="receipt" size={22} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.title} numberOfLines={1}>
          {bill.vendorName || bill.fileName || 'Bill'}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[bill.category ? categoryLabel(bill.category) : null, when ? formatDate(when) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {/* Once sent, how the approval is going matters more than the bill itself. */}
        {ticket ? (
          <StatusBadge status={ticket.status} />
        ) : (
          <BillStatusBadge status={bill.status} />
        )}
        {next ? <Text style={styles.next}>{next}</Text> : null}
      </View>
      {bill.totalAmount != null ? (
        <Text style={styles.amount}>{`${bill.currency ?? ''} ${bill.totalAmount.toLocaleString(LOCALE)}`.trim()}</Text>
      ) : null}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
    flexGrow: 1,
  },
  separator: {
    height: spacing.two,
  },
  more: {
    marginTop: spacing.four,
  },
  header: {
    gap: spacing.three,
    marginBottom: spacing.three,
  },
  upload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: radius.large,
    backgroundColor: colors.primary,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  uploadText: {
    flex: 1,
    gap: 2,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  advanceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.three,
    borderRadius: radius.medium,
    backgroundColor: colors.primarySoft,
  },
  advanceLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.two,
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.three,
    borderRadius: radius.medium,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.three,
    borderRadius: radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  next: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
}));
