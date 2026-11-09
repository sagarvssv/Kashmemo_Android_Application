import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Divider, KeyValue, Section } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { Screen } from '@/components/screen';
import { ErrorState, InlineError, LoadingState } from '@/components/states';
import { StatusBadge, Tag } from '@/components/status-badge';
import { TicketTracker } from '@/components/ticket-tracker';
import { categoryLabel } from '@/constants/expense-categories';
import { AdvancePanel } from '@/features/advances/advance-panel';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { employeeApi, ticketApi } from '@/lib/endpoints';
import { formatDate, formatDateTime, ROLE_LABELS } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { invoiceApi, invoiceApiEnabled } from '@/lib/invoices';
import { can, canActOnTicket } from '@/lib/permissions';
import type { EmployeeDetails, Ticket } from '@/lib/types';

type Sheet = 'reject' | 'disburse' | null;

export default function TicketDetailScreen() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isOpeningBill, setIsOpeningBill] = useState(false);

  const ticket = useApi(() => ticketApi.byId(id).then((r) => r.data), [id]);
  const raiserId = ticket.data?.raisedBy;
  const raiser = useApi<EmployeeDetails | null>(
    () => (raiserId ? employeeApi.details(raiserId).then((r) => r.data) : Promise.resolve(null)),
    [raiserId],
  );

  useRealtime(['ticket:status-update'], (payload) => {
    const updated = (payload as { ticket?: Ticket } | undefined)?.ticket;
    if (updated?.id === id) void ticket.reload();
  });

  if (ticket.isLoading && !ticket.data) {
    return (
      <Screen title="Ticket" backFallback="/tickets">
        <LoadingState />
      </Screen>
    );
  }

  if (!ticket.data) {
    return (
      <Screen title="Ticket" backFallback="/tickets">
        <ErrorState message={ticket.error ?? 'Ticket not found.'} onRetry={ticket.reload} />
      </Screen>
    );
  }

  const data = ticket.data;
  const isMine = data.raisedBy === user.userId;
  const actions = canActOnTicket({
    myRole: user.role,
    myId: user.userId,
    raisedBy: data.raisedBy,
    raiserRole: raiser.data?.role,
    status: data.status,
    source: data.source,
  });
  const isBill = data.source === 'RECEIPT';
  const canDisburse = can.disburse(user.role) && data.status === 'APPROVED';
  // An advance whose cash was handed over: bills, settlement and its money.
  const showAdvance = !isBill && ['DISBURSED', 'SETTLEMENT_PENDING', 'SETTLED'].includes(data.status);
  const raiserName = isMine ? undefined : raiser.data?.name;

  const applyUpdate = (updated: Ticket) => {
    ticket.setData((current) => (current ? { ...current, ...updated } : updated));
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setActionError(null);
    try {
      const { data: updated } = await ticketApi.approve(data.id);
      haptics.success();
      applyUpdate(updated);
    } catch (err) {
      haptics.error();
      setActionError(errorMessage(err));
    } finally {
      setIsApproving(false);
    }
  };

  // The bill's file link expires after 5 minutes, so fetch a fresh one each time.
  const handleOpenBill = async () => {
    if (!data.invoiceId) return;
    setIsOpeningBill(true);
    setActionError(null);
    try {
      const invoice = await invoiceApi.get(data.invoiceId);
      if (!invoice.fileUrl) throw new Error('The bill file is not available.');
      haptics.tap();
      await WebBrowser.openBrowserAsync(invoice.fileUrl);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setIsOpeningBill(false);
    }
  };

  const hasActions = actions.approve || actions.reject || canDisburse;

  return (
    <Screen
      title={isBill ? 'Claim' : 'Advance'}
      subtitle={data.department?.name}
      backFallback="/tickets"
      refreshing={ticket.isRefreshing}
      onRefresh={ticket.refresh}
      footer={
        hasActions ? (
          <View style={styles.footer}>
            {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}
            <View style={styles.actions}>
              {actions.reject && (
                <PrimaryButton
                  label="Reject"
                  variant="secondary"
                  onPress={() => setSheet('reject')}
                  style={styles.action}
                />
              )}
              {actions.approve && (
                <PrimaryButton label="Approve" onPress={handleApprove} loading={isApproving} style={styles.action} />
              )}
              {canDisburse && (
                <PrimaryButton
                  label={isBill ? 'Mark as paid' : 'Hand over cash'}
                  icon="cash-outline"
                  onPress={() => setSheet('disburse')}
                  style={styles.action}
                />
              )}
            </View>
          </View>
        ) : undefined
      }>
      <Card>
        <Text style={styles.amount}>{formatMoney(data.amount)}</Text>
        <Text style={styles.purpose}>{data.purpose}</Text>
        <View style={styles.badges}>
          <StatusBadge status={data.status} />
          {isBill ? <Tag label="From a bill" /> : null}
        </View>
        {/* The rejection reason has its own box below, so it isn't repeated here. */}
        <TicketTracker status={data.status} isMine={isMine} isBill={isBill} />
        {data.status === 'PARTIALLY_APPROVED' && (
          <Text style={styles.note}>
            Amounts above the dual-approval threshold need sign-off from both a Manager and the CEO.
          </Text>
        )}
        {data.status === 'REJECTED' && data.rejectionReason ? (
          <View style={styles.rejection}>
            <Text style={styles.rejectionLabel}>Reason for rejection</Text>
            <Text style={styles.rejectionText}>{data.rejectionReason}</Text>
          </View>
        ) : null}
      </Card>

      {isBill ? (
        <Section title="The bill">
          <Card>
            <KeyValue label="Shop" value={data.vendorName ?? '—'} />
            <Divider />
            <KeyValue label="Bill number" value={data.invoiceNumber ?? '—'} />
            <Divider />
            <KeyValue label="Date on bill" value={data.invoiceDate ? formatDate(data.invoiceDate) : '—'} />
            <Divider />
            <KeyValue label="Type" value={categoryLabel(data.category)} />
            {data.invoiceId && invoiceApiEnabled ? (
              <PrimaryButton
                label="View the bill"
                icon="document-text-outline"
                variant="secondary"
                onPress={handleOpenBill}
                loading={isOpeningBill}
              />
            ) : null}
            {/* With approve/reject buttons, errors show in the footer instead. */}
            {!hasActions ? <InlineError message={actionError} /> : null}
          </Card>
        </Section>
      ) : null}

      {showAdvance ? <AdvancePanel ticket={data} raiserName={raiserName} onChanged={() => void ticket.reload()} /> : null}

      <Section title="Details">
        <Card>
          <KeyValue
            label="Raised by"
            value={isMine ? 'You' : raiser.data ? `${raiser.data.name} · ${ROLE_LABELS[raiser.data.role]}` : '—'}
          />
          <Divider />
          <KeyValue label="Department" value={data.department?.name ?? '—'} />
          <Divider />
          <KeyValue label="Raised on" value={formatDateTime(data.createdAt)} />
        </Card>
      </Section>

      <Section title="Timeline">
        <Card>
          <TimelineStep label="Raised" date={data.createdAt} done />
          {(data.managerApprovedAt || data.ceoApprovedAt) && data.status !== 'REJECTED' ? (
            <>
              {data.managerApprovedAt && <TimelineStep label="Approved by manager" date={data.managerApprovedAt} done />}
              {data.ceoApprovedAt && <TimelineStep label="Approved by CEO" date={data.ceoApprovedAt} done />}
            </>
          ) : null}
          {data.status === 'REJECTED' ? (
            <TimelineStep label="Rejected" date={data.approvedAt} done danger />
          ) : (
            <TimelineStep label="Approved" date={data.approvedAt} done={Boolean(data.approvedAt)} />
          )}
          {data.status !== 'REJECTED' && (
            <TimelineStep label={isBill ? 'Paid out' : 'Cash given'} date={data.disbursedAt} done={Boolean(data.disbursedAt)} />
          )}
          {!isBill && data.status !== 'REJECTED' && (
            <TimelineStep label="Closed" date={data.settledAt} done={data.status === 'SETTLED'} />
          )}
        </Card>
      </Section>

      <PromptModal
        visible={sheet === 'reject'}
        title="Reject ticket"
        message="The person who raised this ticket will see your reason."
        fields={[{ key: 'reason', label: 'Reason', placeholder: 'Why is this being rejected?', multiline: true }]}
        confirmLabel="Reject"
        destructive
        onClose={() => setSheet(null)}
        onSubmit={async ({ reason }) => {
          const { data: updated } = await ticketApi.reject(data.id, reason);
          haptics.warning();
          applyUpdate(updated);
        }}
      />

      <PromptModal
        visible={sheet === 'disburse'}
        title={isBill ? 'Confirm payout' : 'Hand over the advance'}
        message={
          isBill
            ? "Confirm the recipient's email or phone number. It must match the employee who raised this ticket."
            : "Confirm who is collecting the cash (email or phone). It goes into their wallet; they then add bills as they spend."
        }
        fields={[
          {
            key: 'email',
            label: 'Recipient email',
            keyboardType: 'email-address',
            initialValue: raiser.data?.email ?? '',
            optional: true,
          },
          {
            key: 'phoneNumber',
            label: 'or phone number',
            keyboardType: 'phone-pad',
            initialValue: raiser.data?.email ? '' : (raiser.data?.phoneNumber ?? ''),
            optional: true,
          },
        ]}
        confirmLabel={isBill ? 'Mark as paid' : 'Cash handed over'}
        onClose={() => setSheet(null)}
        onSubmit={async ({ email, phoneNumber }) => {
          if (!email && !phoneNumber) throw new Error('Enter the recipient email or phone number.');
          const { data: updated } = await ticketApi.disburse(data.id, email ? { email } : { phoneNumber });
          haptics.success();
          applyUpdate(updated);
        }}
      />
    </Screen>
  );
}

function TimelineStep({
  label,
  date,
  done,
  danger,
}: {
  label: string;
  date: string | null | undefined;
  done: boolean;
  danger?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <View style={[styles.dot, done && styles.dotDone, danger && styles.dotDanger]} />
      <Text style={[styles.stepLabel, !done && styles.stepPending]}>{label}</Text>
      <Text style={styles.stepDate}>{done ? formatDateTime(date) : 'Pending'}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  amount: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  purpose: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  note: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rejection: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: spacing.three,
    gap: 4,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectionText: {
    fontSize: 14,
    color: '#7F1D1D',
  },
  footer: {
    gap: spacing.two,
  },
  actionError: {
    fontSize: 13,
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  action: {
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderLight,
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotDanger: {
    backgroundColor: colors.danger,
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  stepPending: {
    color: colors.textMuted,
  },
  stepDate: {
    fontSize: 13,
    color: colors.textMuted,
  },
}));
