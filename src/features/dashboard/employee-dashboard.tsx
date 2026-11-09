import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Card, Section } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { TicketTracker, trackerText } from '@/components/ticket-tracker';
import { ErrorState } from '@/components/states';
import { radius, spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { ticketApi } from '@/lib/endpoints';
import { invoiceApiEnabled } from '@/lib/invoices';
import { formatRelative, toAmount } from '@/lib/format';
import type { Ticket, TicketStatus } from '@/lib/types';

import { greetingSubtitle, greetingTitle, NotificationBell } from './shared';

// Enough to count an employee's tickets by status without a summary endpoint.
const COUNT_LIMIT = 100;

type IconName = keyof typeof Ionicons.glyphMap;

// Kept simple for people who may not read well: big picture buttons, short
// words, colours that match the ticket status everywhere else in the app.
export function EmployeeDashboard() {
  const styles = useStyles();
  const user = useCurrentUser();
  const formatMoney = useFormatMoney();
  const wallet = useApi(() => ticketApi.wallet(), []);
  const tickets = useApi(() => ticketApi.mine({ limit: COUNT_LIMIT }), []);

  useRealtime(['ticket:status-update', 'ticket:created'], () => {
    void wallet.reload();
    void tickets.reload();
  });

  const refresh = async () => {
    await Promise.all([wallet.refresh(), tickets.refresh()]);
  };

  const walletData = wallet.data?.data;
  // + advance cash with the employee, - what finance owes them.
  const balance = walletData?.balance ?? 0;
  const collectTotal = (walletData?.awaitingCollection ?? []).reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const list = tickets.data?.data;
  const latest = list?.[0];
  // The wallet endpoint counts only approved and paid tickets, so money still
  // waiting for approval (e.g. a bill just sent) is added up from the list.
  const waiting = (list ?? []).filter((ticket) => ticket.status === 'PENDING' || ticket.status === 'PARTIALLY_APPROVED');
  const waitingTotal = waiting.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  // Advances are on the Advances tab and claims on the Claims tab, so the
  // tile opens wherever the waiting money is (advances first).
  const waitingOnlyBills = invoiceApiEnabled && waiting.length > 0 && waiting.every((ticket) => ticket.source === 'RECEIPT');
  const advances = list?.filter((ticket) => ticket.source !== 'RECEIPT');

  return (
    <Screen
      title={greetingTitle(user)}
      subtitle={greetingSubtitle(user)}
      right={<NotificationBell />}
      refreshing={wallet.isRefreshing || tickets.isRefreshing}
      onRefresh={refresh}>
      {wallet.error && !walletData ? <ErrorState message={wallet.error} onRetry={wallet.reload} /> : null}

      {/* Each tile opens My wallet on the matching tab. */}
      <StatGrid>
        <StatTile
          label="Waiting for approval"
          value={formatMoney(waitingTotal)}
          icon="hourglass-outline"
          onPress={() =>
            waitingOnlyBills
              ? router.push('/bills')
              : router.push({ pathname: '/tickets', params: { scope: 'mine', status: 'PENDING' } })
          }
          accessibilityHint="Opens what is waiting for approval"
        />
        <StatTile
          label="Approved · collect from finance"
          value={formatMoney(collectTotal)}
          icon="time-outline"
          tone="highlight"
          onPress={() => router.push({ pathname: '/wallet', params: { tab: 'collect' } })}
          accessibilityHint="Opens the approved money you can collect from finance"
        />
        <StatTile
          label={balance < 0 ? 'Finance owes you' : 'Cash with you'}
          value={formatMoney(Math.abs(balance))}
          icon="wallet-outline"
          onPress={() => router.push({ pathname: '/wallet', params: { tab: 'advances' } })}
          accessibilityHint="Opens your open advances"
        />
      </StatGrid>

      {/* Two ways to get money: ask before spending, or claim back with a bill.
          The backend requires a department on a ticket's raiser. */}
      <View style={styles.actions}>
        {user.departmentId ? (
          <ActionTile
            primary
            icon="add"
            title="Request an advance"
            hint="Need cash before you spend"
            onPress={() => router.push('/raise-ticket')}
          />
        ) : null}
        {invoiceApiEnabled ? (
          <ActionTile
            icon="camera"
            title="Claim money back"
            hint="Spent your own money"
            onPress={() => router.push('/upload-bill')}
          />
        ) : null}
      </View>

      {/* My claims has its own tab for employees. */}
      <LinkTile icon="wallet" title="My wallet" hint="See money approved and paid to you" href="/wallet" />

      {advances && advances.length > 0 ? (
        <Section title="My advances" action={{ label: 'See all', onPress: () => router.push('/tickets') }}>
          <StatusCounts tickets={advances} />
        </Section>
      ) : null}

      {list ? (
        latest ? (
          <Section title={latest.source === 'RECEIPT' ? 'Latest claim' : 'Latest advance'}>
            <LatestTicket ticket={latest} />
          </Section>
        ) : (
          <Section title="How it works">
            <HowItWorks />
          </Section>
        )
      ) : null}
    </Screen>
  );
}

// A big square button for the two main actions.
function ActionTile({
  icon,
  title,
  hint,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <PressableScale
      haptic="tap"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={[styles.actionTile, primary && styles.tilePrimary]}>
      <View style={[styles.iconCircle, primary && styles.iconCirclePrimary]}>
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text style={[styles.tileTitle, primary && styles.onPrimary]}>{title}</Text>
      <Text style={[styles.tileHint, primary && styles.onPrimaryMuted]}>{hint}</Text>
    </PressableScale>
  );
}

// A full-width row that opens another screen.
function LinkTile({ icon, title, hint, href }: { icon: IconName; title: string; hint: string; href: '/wallet' }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={styles.tile}>
      <View style={styles.iconCircleSmall}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.tileText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.tileHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </PressableScale>
  );
}

// Four status boxes. "Partially approved" is still waiting from the
// employee's point of view, so it is counted with "Waiting".
const COUNT_BOXES: { label: string; icon: IconName; color: TicketStatus; statuses: TicketStatus[] }[] = [
  { label: 'Waiting', icon: 'hourglass-outline', color: 'PENDING', statuses: ['PENDING', 'PARTIALLY_APPROVED'] },
  { label: 'Approved', icon: 'thumbs-up-outline', color: 'APPROVED', statuses: ['APPROVED'] },
  { label: 'Paid', icon: 'cash-outline', color: 'DISBURSED', statuses: ['DISBURSED', 'SETTLEMENT_PENDING', 'SETTLED'] },
  { label: 'Rejected', icon: 'close-circle-outline', color: 'REJECTED', statuses: ['REJECTED'] },
];

function StatusCounts({ tickets }: { tickets: Ticket[] }) {
  const styles = useStyles();
  const { statusColors } = useTheme();
  const more = tickets.length >= COUNT_LIMIT ? '+' : '';
  return (
    <View style={styles.counts}>
      {COUNT_BOXES.map((box) => {
        const count = tickets.filter((ticket) => box.statuses.includes(ticket.status)).length;
        const tone = statusColors[box.color];
        return (
          <PressableScale
            key={box.label}
            haptic="tap"
            onPress={() => router.push('/tickets')}
            accessibilityRole="button"
            accessibilityLabel={`${box.label}: ${count} advances`}
            style={[styles.countBox, { backgroundColor: tone.background }]}>
            <Ionicons name={box.icon} size={22} color={tone.text} />
            <Text style={[styles.countValue, { color: tone.text }]}>
              {count}
              {count > 0 ? more : ''}
            </Text>
            <Text style={[styles.countLabel, { color: tone.text }]}>{box.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function LatestTicket({ ticket }: { ticket: Ticket }) {
  const styles = useStyles();
  const formatMoney = useFormatMoney();

  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: ticket.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Latest ${ticket.source === 'RECEIPT' ? 'claim' : 'advance'}, ${ticket.purpose}, ${formatMoney(ticket.amount)}. ${trackerText(ticket.status, true, ticket.source === 'RECEIPT')}`}>
      <Card>
        <View style={styles.latestHeader}>
          <View style={styles.latestText}>
            <Text style={styles.latestPurpose} numberOfLines={1}>
              {ticket.purpose}
            </Text>
            <Text style={styles.latestMeta}>{formatRelative(ticket.createdAt)}</Text>
          </View>
          <Text style={styles.latestAmount}>{formatMoney(ticket.amount)}</Text>
        </View>

        <TicketTracker
          status={ticket.status}
          isMine
          isBill={ticket.source === 'RECEIPT'}
          detail={ticket.status === 'REJECTED' ? ticket.rejectionReason : null}
        />
      </Card>
    </PressableScale>
  );
}

// Shown before the first ticket, so new users know what happens.
function HowItWorks() {
  const styles = useStyles();
  const colors = useColors();
  const items: { icon: IconName; text: string }[] = [
    { icon: 'add', text: 'Need cash before you spend? Request an advance' },
    { icon: 'camera', text: 'Spent your own money? Make a claim with the bill' },
    { icon: 'notifications', text: 'We tell you when it is approved and paid' },
  ];
  return (
    <Card>
      {items.map((item, index) => (
        <View key={item.text} style={styles.howRow}>
          <View style={styles.howIcon}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
          </View>
          <Text style={styles.howText}>
            {index + 1}. {item.text}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const useStyles = createStyles((colors) => ({
  actions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  actionTile: {
    flex: 1,
    gap: spacing.two,
    padding: spacing.four,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  iconCircleSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  linkTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.three,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  tilePrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  iconCirclePrimary: {
    backgroundColor: '#FFFFFF',
  },
  tileText: {
    flex: 1,
    gap: spacing.one,
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tileHint: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  onPrimary: {
    color: '#FFFFFF',
  },
  onPrimaryMuted: {
    color: 'rgba(255,255,255,0.85)',
  },
  counts: {
    flexDirection: 'row',
    gap: spacing.two,
  },
  countBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.three,
    borderRadius: radius.medium,
  },
  countValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.three,
  },
  latestText: {
    flex: 1,
  },
  latestPurpose: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  latestMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  latestAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
  },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  howText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
}));
