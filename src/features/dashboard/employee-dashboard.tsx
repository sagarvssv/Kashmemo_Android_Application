import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/screen';
import { iconBadge, radius, spacing, typography } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors, useTheme } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { ticketApi } from '@/lib/endpoints';
import { STATUS_LABELS, toAmount } from '@/lib/format';
import { invoiceApiEnabled } from '@/lib/invoices';
import type { Ticket, TicketStatus } from '@/lib/types';

import { greetingLine, greetingTitle, HomeAvatar, HomeMeta, NotificationBell, TicketPreviewList } from './shared';

const RECENT_SIZE = 5;
// Fallback count of this month's requests when the summary route is missing.
const MONTH_LIMIT = 100;
// Waiting totals stop here and show "100+".
const PENDING_LIMIT = 100;

type IconName = keyof typeof Ionicons.glyphMap;
type RecentFilter = TicketStatus | 'ALL';
const RECENT_FILTERS: TicketStatus[] = ['PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'DISBURSED', 'REJECTED'];

// How many bills and cash requests the user raised this month. Falls back to
// counting their latest requests if the server has no summary route.
async function countRaisedThisMonth(): Promise<{ count: number; capped: boolean }> {
  const now = new Date();
  try {
    const { data } = await ticketApi.raisedInMonth({ month: now.getMonth() + 1, year: now.getFullYear() });
    return { count: data.count, capped: false };
  } catch {
    const since = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const response = await ticketApi.mine({ limit: MONTH_LIMIT });
    const tickets: Ticket[] = response.data ?? [];
    const inMonth = tickets.filter((ticket) => new Date(ticket.createdAt).getTime() >= since);
    return { count: inMonth.length, capped: inMonth.length === tickets.length && Boolean(response.nextCursor) };
  }
}

// Waiting on someone: fully pending, or approved by one approver of several.
async function loadPending(): Promise<{ count: number; amount: number; capped: boolean }> {
  const [pending, partial] = await Promise.all([
    ticketApi.mine({ status: 'PENDING', limit: PENDING_LIMIT }),
    ticketApi.mine({ status: 'PARTIALLY_APPROVED', limit: PENDING_LIMIT }),
  ]);
  const tickets = [...(pending.data ?? []), ...(partial.data ?? [])];
  return {
    count: tickets.length,
    amount: tickets.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0),
    capped: Boolean(pending.nextCursor || partial.nextCursor),
  };
}

// Employee Home, same layout as the iOS app's (in this app's colours and
// wording): three figures, the Fast Track card with the main actions, and the
// latest requests with status filters.
export function EmployeeDashboard() {
  const styles = useStyles();
  const colors = useColors();
  const { statusColors, statusChartColors } = useTheme();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [filter, setFilter] = useState<RecentFilter>('ALL');

  const raised = useApi(() => countRaisedThisMonth(), []);
  const pending = useApi(() => loadPending(), []);
  const wallet = useApi(() => ticketApi.wallet(), []);
  const recent = useApi(
    () => ticketApi.mine({ limit: RECENT_SIZE, status: filter === 'ALL' ? undefined : filter }),
    [filter],
  );

  useRealtime(['ticket:created', 'ticket:status-update'], () => {
    void raised.reload();
    void pending.reload();
    void wallet.reload();
    void recent.reload();
  });

  const refresh = async () => {
    await Promise.all([raised.refresh(), pending.refresh(), wallet.refresh(), recent.refresh()]);
  };

  const placeholder = (state: { error: string | null }) => (state.error ? '—' : '…');
  const walletData = wallet.data?.data;
  // Approved, not yet collected from finance.
  const awaitingCollection = (walletData?.awaitingCollection ?? []).reduce(
    (sum, ticket) => sum + toAmount(ticket.amount),
    0,
  );
  const openRequests = walletData?.openAdvances.length ?? 0;

  const filterOptions: { value: RecentFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    ...RECENT_FILTERS.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
  ];

  return (
    <Screen
      overline={greetingLine()}
      title={greetingTitle(user)}
      leading={<HomeAvatar />}
      meta={<HomeMeta label="Employee Dashboard" icon="grid-outline" />}
      // Employees have no Alerts tab, so notifications open from here.
      right={<NotificationBell />}
      refreshing={raised.isRefreshing || pending.isRefreshing || wallet.isRefreshing || recent.isRefreshing}
      onRefresh={refresh}>
      <View style={styles.metrics}>
        <Metric
          icon="receipt-outline"
          label="Total bills raised"
          value={raised.data ? `${raised.data.count}${raised.data.capped ? '+' : ''}` : placeholder(raised)}
          footer={<Text style={styles.metricCaption}>This month</Text>}
        />
        <Metric
          icon="hourglass-outline"
          tint={statusColors.PENDING.text}
          label="Pending amount"
          value={pending.data ? formatMoney(pending.data.amount) : placeholder(pending)}
          footer={
            pending.data ? (
              <View style={[styles.badge, { backgroundColor: statusColors.PENDING.background }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusChartColors.PENDING }]} />
                <Text style={[styles.badgeText, { color: statusColors.PENDING.text }]} numberOfLines={1}>
                  {pending.data.count}
                  {pending.data.capped ? '+' : ''} waiting for approval
                </Text>
              </View>
            ) : null
          }
        />
        <Metric
          icon="wallet-outline"
          tint={statusColors.APPROVED.text}
          label="Wallet · cash in hand"
          value={walletData ? formatMoney(walletData.cashInHand) : placeholder(wallet)}
          onPress={() => router.push('/wallet')}
          footer={
            walletData ? (
              walletData.overspent > 0 ? (
                <View style={[styles.badge, { backgroundColor: statusColors.REJECTED.background }]}>
                  <View style={[styles.badgeDot, { backgroundColor: statusChartColors.REJECTED }]} />
                  <Text style={[styles.badgeText, { color: statusColors.REJECTED.text }]} numberOfLines={1}>
                    Overspent · {formatMoney(walletData.overspent)} owed to you
                  </Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: statusColors.APPROVED.background }]}>
                  <View style={[styles.badgeDot, { backgroundColor: statusChartColors.APPROVED }]} />
                  <Text style={[styles.badgeText, { color: statusColors.APPROVED.text }]} numberOfLines={1}>
                    {awaitingCollection > 0
                      ? `${formatMoney(awaitingCollection)} to collect from finance`
                      : `${openRequests} open cash request${openRequests === 1 ? '' : 's'}`}
                  </Text>
                </View>
              )
            ) : null
          }
        />
      </View>

      {/* Fast Track: the main call to action. */}
      <View style={[styles.fastTrack, { backgroundColor: colors.primary }]}>
        <View style={styles.fastTrackHeader}>
          <Ionicons name="flash" size={14} color="#FFFFFF" />
          <Text style={styles.fastTrackOverline}>Fast Track</Text>
        </View>
        <Text style={styles.fastTrackTitle}>Need reimbursement?</Text>
        <Text style={styles.fastTrackBody}>Snap your bill and send it within 24 hours.</Text>
        {invoiceApiEnabled ? (
          <PressableScale
            haptic="tap"
            onPress={() => router.push('/upload-bill')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.fastTrackButton, pressed && styles.pressed]}>
            <Ionicons name="camera" size={18} color={colors.primary} />
            <Text style={[styles.fastTrackButtonText, { color: colors.primary }]}>Scan a bill</Text>
          </PressableScale>
        ) : null}
        {/* The backend needs a department on whoever asks for cash. */}
        {user.departmentId ? (
          <PressableScale
            haptic="tap"
            onPress={() => router.push('/raise-ticket')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.fastTrackButton, styles.fastTrackButtonOutline, pressed && styles.pressed]}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={[styles.fastTrackButtonText, { color: '#FFFFFF' }]}>Request cash</Text>
          </PressableScale>
        ) : (
          <Text style={styles.fastTrackBody}>Ask your admin to assign you a department to request cash.</Text>
        )}
      </View>

      <TicketPreviewList
        title="Recent requests"
        filter={<ChipGroup options={filterOptions} value={filter} onChange={setFilter} />}
        tickets={recent.isLoading ? undefined : recent.data?.data}
        emptyTitle={
          recent.error ??
          (recent.isLoading
            ? 'Loading…'
            : filter === 'ALL'
              ? "You haven't raised anything yet"
              : `Nothing ${STATUS_LABELS[filter].toLowerCase()}`)
        }
        onSeeAll={() => router.push({ pathname: '/tickets', params: filter === 'ALL' ? {} : { status: filter } })}
      />
    </Screen>
  );
}

// A figure card: icon badge, small label, big value, and a footer line.
function Metric({
  icon,
  tint,
  label,
  value,
  footer,
  onPress,
}: {
  icon: IconName;
  tint?: string;
  label: string;
  value: string;
  footer?: React.ReactNode;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const accent = tint ?? colors.primary;
  const content = (
    <>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: iconBadge(accent) }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textMuted} /> : null}
      </View>
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
      {/* No adjustsFontSizeToFit: on Android it can draw nothing at all. */}
      <Text style={[styles.metricValue, value.length > 11 && styles.metricValueLong]} numberOfLines={1}>
        {value}
      </Text>
      {footer}
    </>
  );
  if (!onPress) return <View style={[styles.metric, styles.metricCard]}>{content}</View>;
  return (
    <PressableScale
      haptic="tap"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.metric, styles.metricCard, pressed && styles.pressed]}>
      {content}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  pressed: {
    opacity: 0.75,
  },
  // Two per row; an odd last card spans the full width.
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.three,
  },
  metric: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
  },
  metricCard: {
    borderRadius: radius.large,
    padding: spacing.three,
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...typography.overline,
    color: colors.textMuted,
  },
  metricValue: {
    ...typography.title,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metricValueLong: {
    fontSize: 15,
  },
  metricCaption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    maxWidth: '100%',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...typography.captionStrong,
    flexShrink: 1,
  },
  // Fast Track
  fastTrack: {
    borderRadius: radius.large,
    padding: spacing.four,
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  fastTrackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fastTrackOverline: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.85)',
  },
  fastTrackTitle: {
    ...typography.headline,
    fontSize: 17,
    color: '#FFFFFF',
  },
  fastTrackBody: {
    ...typography.footnote,
    color: 'rgba(255,255,255,0.85)',
  },
  fastTrackButton: {
    marginTop: spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    height: 44,
    borderRadius: radius.medium,
    backgroundColor: '#FFFFFF',
  },
  fastTrackButtonOutline: {
    marginTop: 0,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  fastTrackButtonText: {
    ...typography.button,
  },
}));
