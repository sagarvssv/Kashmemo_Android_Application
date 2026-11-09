import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Card, Divider, KeyValue, Section } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ErrorState, InlineError, LoadingState } from '@/components/states';
import { TicketTracker } from '@/components/ticket-tracker';
import { categoryLabel } from '@/constants/expense-categories';
import { spacing } from '@/constants/theme';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { LOCALE } from '@/lib/config';
import { formatDate, formatDateTime } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { invoiceApi } from '@/lib/invoices';
import { BILL_STATUS, BillStatusBadge } from '@/features/bills/bill-status';
import { BillStatusPill } from '@/features/advances/advance-ui';
import { useBillTickets } from '@/features/bills/bill-tickets';

const REFRESH_WHILE_READING_MS = 4000;

const STATUS_TEXT: Record<string, string> = {
  UPLOAD_PENDING: 'We are reading your bill. This takes about 30 seconds.',
  PROCESSING: 'We are reading your bill. This takes about 30 seconds.',
  COMPLETED: 'Your bill was read but not sent yet. Check it and send it.',
  CONFIRMED: 'Your bill was checked.',
  DUPLICATE: 'This bill was already used. A bill can be claimed only once.',
  FAILED: 'We could not read this bill.',
};

export default function BillDetailScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { statusColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useApi(() => invoiceApi.get(id), [id]);
  const billTickets = useBillTickets();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  const status = bill.data?.status;
  const isReading = status === 'UPLOAD_PENDING' || status === 'PROCESSING';

  // Keep checking while the bill is still being read.
  const { reload } = bill;
  useEffect(() => {
    if (!isReading) return;
    const timer = setInterval(() => void reload(), REFRESH_WHILE_READING_MS);
    return () => clearInterval(timer);
  }, [isReading, reload]);

  if (bill.isLoading && !bill.data) {
    return (
      <Screen title="Bill" backFallback="/bills">
        <LoadingState />
      </Screen>
    );
  }
  if (!bill.data) {
    return (
      <Screen title="Bill" backFallback="/bills">
        <ErrorState message={bill.error ?? 'Bill not found.'} onRetry={bill.reload} />
      </Screen>
    );
  }

  const data = bill.data;
  // Where the bill went once sent: its own receipt ticket, or an advance.
  const ticket = billTickets.byInvoice.get(data.invoiceId);
  const advanceBill = billTickets.onAdvance.get(data.invoiceId);
  const extracted = data.extracted ?? {};
  const tone = statusColors[BILL_STATUS[data.status].tone];
  const money = (value: number | null | undefined) =>
    value != null ? `${extracted.currency ?? ''} ${value.toLocaleString(LOCALE)}`.trim() : '—';

  const handleRetry = async () => {
    setIsRetrying(true);
    setActionError(null);
    try {
      await invoiceApi.reprocess(data.invoiceId);
      await bill.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIsRetrying(false);
    }
  };

  // The file link expires after 5 minutes, so fetch a fresh one first.
  const handleOpenFile = async () => {
    setIsOpening(true);
    setActionError(null);
    try {
      const fresh = await invoiceApi.get(data.invoiceId);
      if (!fresh.fileUrl) throw new Error('The bill file is not available.');
      haptics.tap();
      await WebBrowser.openBrowserAsync(fresh.fileUrl);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Screen
      title={extracted.vendorName || 'Bill'}
      subtitle={data.uploadedAt ? `Uploaded ${formatDateTime(data.uploadedAt)}` : undefined}
      backFallback="/bills"
      refreshing={bill.isRefreshing}
      onRefresh={() => Promise.all([bill.refresh(), billTickets.refresh()]).then(() => {})}
      footer={
        data.status === 'COMPLETED' ? (
          <PrimaryButton
            label="Check and send"
            icon="paper-plane"
            onPress={() => router.push({ pathname: '/upload-bill', params: { invoiceId: data.invoiceId } })}
          />
        ) : data.status === 'CONFIRMED' && !billTickets.isLoading ? (
          ticket ? (
            <PrimaryButton
              label="See the approval"
              icon="receipt-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
            />
          ) : advanceBill ? (
            <PrimaryButton
              label="See the advance"
              icon="wallet-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: advanceBill.ticketId } })}
            />
          ) : (
            // Checked but never sent (e.g. sending failed): finish it on the
            // upload screen, where the user picks an advance or their own money.
            <PrimaryButton
              label="Send my claim"
              icon="paper-plane"
              onPress={() => router.push({ pathname: '/upload-bill', params: { invoiceId: data.invoiceId } })}
            />
          )
        ) : data.status === 'FAILED' ? (
          <PrimaryButton label="Try again" icon="refresh" onPress={handleRetry} loading={isRetrying} />
        ) : undefined
      }>
      <Card>
        <Text style={styles.amount}>{money(extracted.totalAmount)}</Text>
        <BillStatusBadge status={data.status} />
        <View style={[styles.statusBox, { backgroundColor: tone.background }]}>
          {isReading ? <ActivityIndicator color={tone.text} /> : null}
          <Text style={[styles.statusText, { color: tone.text }]}>
            {STATUS_TEXT[data.status]}
            {data.status === 'FAILED' && data.error ? ` (${data.error})` : ''}
          </Text>
        </View>
        {data.needsReview && data.status !== 'CONFIRMED' && data.categoryReason ? (
          <Text style={styles.note}>{data.categoryReason}</Text>
        ) : null}
        {ticket ? <TicketTracker status={ticket.status} isMine isBill detail={ticket.rejectionReason} /> : null}
        {advanceBill ? (
          <View style={styles.advanceBox}>
            <BillStatusPill status={advanceBill.status} />
            <Text style={styles.advanceText}>Added to your advance &quot;{advanceBill.ticket.purpose}&quot;</Text>
            {advanceBill.status === 'REJECTED' && advanceBill.rejectionReason ? (
              <Text style={styles.note}>Reason: {advanceBill.rejectionReason}</Text>
            ) : null}
          </View>
        ) : null}
        <InlineError message={actionError} />
        <PrimaryButton
          label="View the bill"
          icon="document-text-outline"
          variant="secondary"
          onPress={handleOpenFile}
          loading={isOpening}
        />
      </Card>

      {!isReading && data.status !== 'FAILED' ? (
        <Section title="Details">
          <Card>
            <KeyValue label="Shop" value={extracted.vendorName ?? '—'} />
            <Divider />
            <KeyValue label="Date on bill" value={extracted.invoiceDate ? formatDate(extracted.invoiceDate) : '—'} />
            <Divider />
            <KeyValue label="Bill number" value={extracted.invoiceNumber ?? '—'} />
            <Divider />
            <KeyValue label="Type" value={categoryLabel(data.category)} />
            {extracted.taxAmount != null ? (
              <>
                <Divider />
                <KeyValue label="Tax" value={money(extracted.taxAmount)} />
              </>
            ) : null}
            {extracted.paymentMethod ? (
              <>
                <Divider />
                <KeyValue label="Paid by" value={extracted.paymentMethod} />
              </>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {extracted.lineItems && extracted.lineItems.length > 0 ? (
        <Section title="Items on the bill">
          <Card>
            {extracted.lineItems.map((item, index) => (
              <View key={index} style={styles.item}>
                <Ionicons name="ellipse" size={6} color={colors.textMuted} />
                <Text style={styles.itemText} numberOfLines={2}>
                  {item.description ?? 'Item'}
                  {item.quantity && item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                </Text>
                <Text style={styles.itemAmount}>{money(item.amount)}</Text>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  amount: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderRadius: 10,
    padding: spacing.three,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  advanceBox: {
    gap: spacing.one,
  },
  advanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
}));
