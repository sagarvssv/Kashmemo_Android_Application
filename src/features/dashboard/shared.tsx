import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, ListRow, Section } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { HeaderIconButton } from '@/components/screen';
import { PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { EmptyState } from '@/components/states';
import { ProgressBar } from '@/components/stat-tile';
import { TicketRow } from '@/components/ticket-row';
import { iconBadge, spacing, typography } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime, useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { dashboardApi, departmentApi, ticketApi } from '@/lib/endpoints';
import { can } from '@/lib/permissions';
import { formatRelative, initials, ROLE_LABELS } from '@/lib/format';
import type { BudgetStatus, SessionUser, Ticket } from '@/lib/types';

// Home header: the greeting on a small line, the first name as the title, so
// a long name isn't cut off next to the avatar and buttons.
export function greetingLine() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export function greetingTitle(user: SessionUser) {
  return user.name.split(' ')[0];
}

export function greetingSubtitle(user: SessionUser) {
  return [ROLE_LABELS[user.role], user.companyName].filter(Boolean).join(' · ');
}

// Ask for cash before spending (needs a department on the raiser, as the
// backend requires). Scanning a bill is on the Scan tab.
export function RaiseTicketButton() {
  const styles = useStyles();
  const user = useCurrentUser();
  if (!user.departmentId) return null;
  return (
    <View style={styles.actionRow}>
      <PrimaryButton
        label="Request cash"
        icon="add-circle-outline"
        onPress={() => router.push('/raise-ticket')}
        style={styles.action}
      />
    </View>
  );
}

// Same unread count as the Alerts tab badge (kept live by the session's socket).
export function NotificationBell() {
  const { unreadCount } = useSession();
  return (
    <HeaderIconButton
      icon="notifications-outline"
      onPress={() => router.push('/notifications')}
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      badge={unreadCount}
    />
  );
}

// Initials at the top right of Home (iOS ProfileButton); opens Menu.
export function ProfileButton() {
  const styles = useStyles();
  const colors = useColors();
  const user = useCurrentUser();
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push('/profile')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      style={[styles.profileButton, { backgroundColor: colors.primary }]}>
      <Text style={styles.profileInitials}>{initials(user.name)}</Text>
      {/* Nudge towards the profile while a temporary password is still in use. */}
      {user.mustResetPassword ? <View style={[styles.profileDot, { borderColor: colors.background }]} /> : null}
    </PressableScale>
  );
}

// Home header, same layout as the iOS app: the user's initials on the left
// (opens Menu), and under the greeting a role pill with the company name.
export function HomeAvatar() {
  const styles = useStyles();
  const colors = useColors();
  const user = useCurrentUser();
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
      style={[styles.avatar, { backgroundColor: colors.primary }]}>
      <Text style={styles.avatarText}>{initials(user.name)}</Text>
      {/* Nudge towards the profile while a temporary password is still in use. */}
      {user.mustResetPassword ? <View style={[styles.avatarDot, { borderColor: colors.background }]} /> : null}
    </PressableScale>
  );
}

// `label` replaces the role/designation in the pill, e.g. the dashboard name.
export function HomeMeta({ label, icon = 'briefcase-outline' }: { label?: string; icon?: keyof typeof Ionicons.glyphMap } = {}) {
  const styles = useStyles();
  const colors = useColors();
  const user = useCurrentUser();
  return (
    <View style={styles.metaRow}>
      <View style={[styles.rolePill, { backgroundColor: iconBadge(colors.primary) }]}>
        <Ionicons name={icon} size={11} color={colors.primary} />
        <Text style={[styles.rolePillText, { color: colors.primary }]} numberOfLines={1}>
          {label ?? (user.designation || ROLE_LABELS[user.role])}
        </Text>
      </View>
      {user.companyName ? (
        <Text style={styles.company} numberOfLines={1}>
          {user.companyName}
        </Text>
      ) : null}
    </View>
  );
}

export function TicketPreviewList({
  title,
  tickets,
  emptyTitle,
  onSeeAll,
  filter,
  collapsible,
}: {
  title: string;
  tickets: Ticket[] | undefined;
  emptyTitle: string;
  onSeeAll?: () => void;
  // Rendered between the heading and the list, e.g. a row of filter chips.
  filter?: React.ReactNode;
  // A triangle before the title opens and closes the list.
  collapsible?: boolean;
}) {
  const styles = useStyles();
  return (
    <Section
      title={title}
      collapsible={collapsible}
      action={onSeeAll ? { label: 'See all', onPress: onSeeAll } : undefined}>
      {filter}
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

// Shortcut to the daily bill report, for the roles that can open it.
export function DailyReportShortcut() {
  const styles = useStyles();
  const user = useCurrentUser();
  if (!can.viewDailyReport(user.role)) return null;
  return (
    <Card style={styles.compactCard}>
      <ListRow
        icon="calendar-outline"
        title="Daily bill report"
        subtitle="Bills raised per day, by status and amount"
        onPress={() => router.push({ pathname: '/reports', params: { view: 'daily' } })}
      />
    </Card>
  );
}

const ALL_DEPARTMENTS = 'ALL';
const DEPARTMENT_PREVIEW_SIZE = 5;

// Latest organisation bills with a row of department chips to narrow them down.
// `refreshToken` lets the parent screen's pull-to-refresh reload it too.
export function DepartmentTicketsPreview({ refreshToken = 0 }: { refreshToken?: number }) {
  const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);
  const departments = useApi(() => departmentApi.list(), []);
  const tickets = useApi(
    () =>
      ticketApi.organization({
        limit: DEPARTMENT_PREVIEW_SIZE,
        departmentId: departmentId === ALL_DEPARTMENTS ? undefined : departmentId,
      }),
    [departmentId, refreshToken],
  );

  useRealtime(['ticket:created', 'ticket:status-update'], () => {
    void tickets.reload();
  });

  const options = [
    { value: ALL_DEPARTMENTS, label: 'All' },
    ...(departments.data?.data ?? []).map((department) => ({ value: department.id, label: department.name })),
  ];

  return (
    <TicketPreviewList
      title="Bills by department"
      collapsible
      filter={options.length > 1 ? <ChipGroup options={options} value={departmentId} onChange={setDepartmentId} /> : null}
      tickets={tickets.data?.data.slice(0, DEPARTMENT_PREVIEW_SIZE)}
      emptyTitle={tickets.error ?? (tickets.isLoading ? 'Loading…' : 'No bills for this department')}
      onSeeAll={() =>
        router.push({
          pathname: '/tickets',
          params: { scope: 'all', ...(departmentId === ALL_DEPARTMENTS ? {} : { departmentId }) },
        })
      }
    />
  );
}

// Compact department budget row: department icon, allocation and a thin spend
// bar. Opens the department's budget page.
export function DepartmentBudgetRow({ status, first }: { status: BudgetStatus; first: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const ratio = status.totalAllocated > 0 ? Math.min(status.spent / status.totalAllocated, 1) : 0;
  const over = status.remaining < 0;

  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push({ pathname: '/department/[id]', params: { id: status.departmentId.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${status.departmentId.name}. Open budget`}
      style={({ pressed }) => [styles.deptRow, !first && styles.deptRowDivider, pressed && styles.pressed]}>
      <View style={[styles.deptIcon, { backgroundColor: iconBadge(colors.primary) }]}>
        <Ionicons name="business-outline" size={16} color={colors.primary} />
      </View>
      <View style={styles.deptBody}>
        <View style={styles.deptLine}>
          <Text style={styles.deptName} numberOfLines={1}>
            {status.departmentId.name}
          </Text>
          <Text style={styles.deptAmount}>{status.hasBudgetSet ? formatMoney(status.totalAllocated) : '—'}</Text>
        </View>
        {status.hasBudgetSet ? (
          <>
            <View style={styles.deptTrack}>
              <View
                style={[
                  styles.deptFill,
                  { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.primary },
                  (over || ratio > 0.9) && { backgroundColor: colors.danger },
                ]}
              />
            </View>
            <View style={styles.deptLine}>
              <Text style={styles.deptMeta}>Spent {formatMoney(status.spent)}</Text>
              <Text style={[styles.deptMetaStrong, over && { color: colors.danger }]}>
                {formatMoney(status.remaining)} left
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.deptMeta}>No budget set this month</Text>
        )}
      </View>
    </PressableScale>
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
  profileButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInitials: {
    ...typography.footnoteStrong,
    color: '#FFFFFF',
  },
  profileDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: colors.danger,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.headline,
    color: '#FFFFFF',
  },
  avatarDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: colors.danger,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    marginTop: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 1,
  },
  rolePillText: {
    ...typography.captionStrong,
  },
  company: {
    ...typography.footnote,
    color: colors.textMuted,
    flexShrink: 1,
  },
  list: {
    gap: spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: spacing.three,
  },
  deptRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  deptIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptBody: {
    flex: 1,
    gap: 5,
  },
  deptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.two,
  },
  deptName: {
    ...typography.footnoteStrong,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  deptAmount: {
    ...typography.footnoteStrong,
    color: colors.textPrimary,
  },
  deptTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  deptFill: {
    height: '100%',
    borderRadius: 999,
  },
  deptMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deptMetaStrong: {
    ...typography.captionStrong,
    color: colors.primary,
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
