import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Card, ListRow, Section } from '@/components/card';
import { PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { EmptyState } from '@/components/states';
import { ProgressBar } from '@/components/stat-tile';
import { TicketRow } from '@/components/ticket-row';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { dashboardApi } from '@/lib/endpoints';
import { formatRelative, ROLE_LABELS } from '@/lib/format';
import { invoiceApiEnabled } from '@/lib/invoices';
import type { BudgetStatus, SessionUser, Ticket } from '@/lib/types';

export function greetingTitle(user: SessionUser) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${user.name.split(' ')[0]}`;
}

export function greetingSubtitle(user: SessionUser) {
  return [ROLE_LABELS[user.role], user.companyName].filter(Boolean).join(' · ');
}

// Two ways to get money: ask before spending (an advance, which needs a
// department on the raiser, as the backend requires) or claim back with a bill.
export function RaiseTicketButton() {
  const styles = useStyles();
  const user = useCurrentUser();
  return (
    <View style={styles.actionRow}>
      {user.departmentId ? (
        <PrimaryButton
          label="Request an advance"
          icon="add-circle-outline"
          onPress={() => router.push('/raise-ticket')}
          style={styles.action}
        />
      ) : null}
      {invoiceApiEnabled ? (
        <PrimaryButton
          label="Claim money back"
          icon="camera-outline"
          variant="secondary"
          onPress={() => router.push('/upload-bill')}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

// Same unread count as the Alerts tab badge (kept live by the session's socket).
export function NotificationBell() {
  const styles = useStyles();
  const colors = useColors();
  const { unreadCount } = useSession();
  const label = unreadCount > 99 ? '99+' : String(unreadCount);
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}>
      <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{label}</Text>
        </View>
      )}
    </PressableScale>
  );
}

export function TicketPreviewList({
  title,
  tickets,
  emptyTitle,
  onSeeAll,
}: {
  title: string;
  tickets: Ticket[] | undefined;
  emptyTitle: string;
  onSeeAll?: () => void;
}) {
  const styles = useStyles();
  return (
    <Section title={title} action={onSeeAll ? { label: 'See all', onPress: onSeeAll } : undefined}>
      {tickets && tickets.length > 0 ? (
        <View style={styles.list}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState icon="checkmark-done-outline" title={emptyTitle} />
        </Card>
      )}
    </Section>
  );
}

export function RecentActivityPreview({ limit = 5 }: { limit?: number }) {
  const styles = useStyles();
  const { data } = useApi(() => dashboardApi.recentActivity({ limit }), [limit]);
  const activity = data?.data ?? [];

  return (
    <Section title="Recent activity" action={{ label: 'See all', onPress: () => router.push('/activity') }}>
      <Card style={styles.compactCard}>
        {activity.length === 0 ? (
          <EmptyState icon="pulse-outline" title="No activity yet" />
        ) : (
          activity.map((entry) => (
            <ListRow
              key={entry.id}
              icon="pulse-outline"
              title={entry.message}
              subtitle={`${entry.actor?.name ?? 'Someone'} · ${formatRelative(entry.createdAt)}`}
            />
          ))
        )}
      </Card>
    </Section>
  );
}

export function BudgetCard({ status, onPress }: { status: BudgetStatus; onPress?: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const content = (
    <Card>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetTitle}>{status.departmentId.name}</Text>
        {onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
      </View>
      {status.hasBudgetSet ? (
        <>
          <ProgressBar value={status.spent} max={status.totalAllocated} />
          <View style={styles.budgetRow}>
            <Text style={styles.budgetMeta}>Spent {formatMoney(status.spent)}</Text>
            <Text style={styles.budgetMeta}>of {formatMoney(status.totalAllocated)}</Text>
          </View>
          <Text style={[styles.remaining, status.remaining < 0 && { color: colors.danger }]}>
            {formatMoney(status.remaining)} remaining
          </Text>
        </>
      ) : (
        <Text style={styles.budgetMeta}>No budget set for this month.</Text>
      )}
    </Card>
  );

  if (!onPress) return content;
  return (
    <PressableScale haptic="tap" onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {content}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  actionRow: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  action: {
    flex: 1,
  },
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    // A ring in the page colour keeps the badge readable over the icon.
    borderWidth: 2,
    borderColor: colors.background,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  list: {
    gap: spacing.three,
  },
  compactCard: {
    gap: 0,
    paddingVertical: spacing.one,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  remaining: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
}));
