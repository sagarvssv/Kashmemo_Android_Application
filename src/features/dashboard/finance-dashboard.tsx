import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Section } from '@/components/card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { iconBadge, radius, spacing, typography } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { AdvanceShortcuts, useAdvanceAttention } from '@/features/advances/advance-attention';
import { useApi } from '@/hooks/use-api';
import { dashboardApi, departmentApi, ticketApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';
import type { BudgetStatus } from '@/lib/types';

import {
  DailyReportShortcut,
  DepartmentBudgetRow,
  DepartmentTicketsPreview,
  greetingLine,
  greetingTitle,
  HomeAvatar,
  HomeMeta,
  NotificationBell,
  RaiseTicketButton,
  TicketPreviewList,
} from './shared';

const PREVIEW_SIZE = 5;

type IconName = keyof typeof Ionicons.glyphMap;

// Finance Manager Home, same layout as the iOS app's (in this app's colours and
// wording). The role can't read /dashboard/summary, so it is built from each
// department's budget status and the bill endpoints it can use.
export function FinanceDashboard() {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);
  const [refreshToken, setRefreshToken] = useState(0);

  // Each department's status loads on its own, so one failure doesn't blank
  // the whole section (that department just shows "no budget").
  const statuses = useApi(async (): Promise<BudgetStatus[]> => {
    const { data: departments } = await departmentApi.list();
    const results = await Promise.allSettled(
      departments.map((department) => departmentApi.budgetStatus(department.id, month).then((r) => r.data)),
    );
    if (departments.length > 0 && results.every((result) => result.status === 'rejected')) {
      throw (results[0] as PromiseRejectedResult).reason;
    }
    return departments.map((department, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') return result.value;
      return {
        departmentId: { id: department.id, name: department.name },
        month: month.month,
        year: month.year,
        totalAllocated: 0,
        spent: 0,
        remaining: 0,
        hasBudgetSet: false,
      };
    });
  }, [month]);
  const pending = useApi(() => dashboardApi.pendingTickets(month), [month]);
  const toDisburse = useApi(() => ticketApi.organization({ status: 'APPROVED', limit: PREVIEW_SIZE }), []);
  const advanceWork = useAdvanceAttention();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update'], () => {
    void statuses.reload();
    void pending.reload();
    void toDisburse.reload();
  });

  const refresh = async () => {
    setRefreshToken((token) => token + 1);
    await Promise.all([
      statuses.refresh(),
      pending.refresh(),
      toDisburse.refresh(),
      advanceWork.refresh(),
    ]);
  };

  const statusList = statuses.data ?? [];
  const budgeted = statusList.filter((status) => status.hasBudgetSet);
  const totalAllocated = budgeted.reduce((sum, status) => sum + toAmount(status.totalAllocated), 0);
  const totalSpent = budgeted.reduce((sum, status) => sum + toAmount(status.spent), 0);
  const totalRemaining = budgeted.reduce((sum, status) => sum + toAmount(status.remaining), 0);
  const pendingList = pending.data?.data ?? [];
  const pendingAmount = pendingList.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const ownBudget = statusList.find((status) => status.departmentId.id === user.departmentId);
  const budgetsLoading = statuses.isLoading && !statuses.data;

  return (
    <Screen
      overline={greetingLine()}
      title={greetingTitle(user)}
      leading={<HomeAvatar />}
      meta={<HomeMeta />}
      right={<NotificationBell />}
      refreshing={statuses.isRefreshing}
      onRefresh={refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      {user.departmentId ? <OwnBudgetCard status={ownBudget} loading={budgetsLoading} /> : null}

      <View style={styles.kpiGrid}>
        <Kpi icon="pie-chart" label="Allocated" value={formatMoney(totalAllocated)} />
        <Kpi icon="trending-up" label="Spent" value={formatMoney(totalSpent)} />
        <Kpi
          icon="wallet"
          tint={totalRemaining < 0 ? colors.danger : undefined}
          label="Remaining"
          value={formatMoney(totalRemaining)}
        />
        <Kpi
          icon="time"
          label={`${pendingList.length} pending`}
          value={formatMoney(pendingAmount)}
          onPress={() => router.push({ pathname: '/tickets', params: { scope: 'all', status: 'PENDING' } })}
        />
      </View>

      <RaiseTicketButton />

      <AdvanceShortcuts attention={advanceWork} />

      <Section
        title="Budgets by department"
        collapsible
        action={{ label: 'Manage', onPress: () => router.push('/departments') }}>
        <Card style={styles.budgetCard}>
          {statuses.error && !statuses.data ? <ErrorState message={statuses.error} onRetry={statuses.reload} /> : null}
          {budgetsLoading && !statuses.error ? <LoadingState rows={3} /> : null}
          {statuses.data && statusList.length === 0 ? (
            <EmptyState icon="pie-chart-outline" title="No departments yet" />
          ) : null}
          {statusList.map((status, index) => (
            <DepartmentBudgetRow key={status.departmentId.id} status={status} first={index === 0} />
          ))}
        </Card>
      </Section>

      <DailyReportShortcut />

      <DepartmentTicketsPreview refreshToken={refreshToken} />

      <TicketPreviewList
        title="Waiting for your approval"
        collapsible
        tickets={pending.data ? pendingList.slice(0, PREVIEW_SIZE) : undefined}
        emptyTitle={pending.error ?? (pending.isLoading ? 'Loading…' : 'Nothing waiting for approval')}
        onSeeAll={() => router.push({ pathname: '/tickets', params: { scope: 'all', status: 'PENDING' } })}
      />

      <TicketPreviewList
        title="Approved · ready to disburse"
        collapsible
        tickets={toDisburse.data?.data}
        emptyTitle={toDisburse.error ?? (toDisburse.isLoading ? 'Loading…' : 'No approved bills waiting for payout')}
        onSeeAll={() => router.push({ pathname: '/tickets', params: { scope: 'all', status: 'APPROVED' } })}
      />

    </Screen>
  );
}

// The signed-in Finance Manager's own department budget for the month, on a
// solid card in the primary colour (same as iOS).
function OwnBudgetCard({ status, loading }: { status: BudgetStatus | undefined; loading: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const allocated = toAmount(status?.totalAllocated);
  const spent = toAmount(status?.spent);
  const remaining = toAmount(status?.remaining);
  const ratio = allocated > 0 ? Math.min(spent / allocated, 1) : 0;
  const percentUsed = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
  const over = remaining < 0;

  return (
    <View style={[styles.hero, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
      <View style={styles.heroHeader}>
        <View style={styles.heroIcon}>
          <Ionicons name="wallet" size={16} color={colors.primary} />
        </View>
        <Text style={styles.heroLabel} numberOfLines={1}>
          My budget{status ? ` · ${status.departmentId.name}` : ''}
        </Text>
      </View>

      {loading ? (
        <Text style={styles.heroMeta}>Loading your budget…</Text>
      ) : !status || !status.hasBudgetSet ? (
        <Text style={styles.heroMeta}>No budget set for your department this month.</Text>
      ) : (
        <>
          <View>
            <Text style={[styles.heroValue, over && styles.heroValueOver]} numberOfLines={1}>
              {formatMoney(remaining)}
            </Text>
            <Text style={styles.heroCaption}>{over ? 'over budget' : 'remaining this month'}</Text>
          </View>
          <View style={styles.heroTrack}>
            <View
              style={[styles.heroFill, { width: `${Math.round(ratio * 100)}%` }, ratio > 0.9 && styles.heroFillAlert]}
            />
          </View>
          <View style={styles.heroRow}>
            <Text style={styles.heroMeta}>
              Spent {formatMoney(spent)} of {formatMoney(allocated)}
            </Text>
            <Text style={styles.heroMetaStrong}>{percentUsed}% used</Text>
          </View>
        </>
      )}
    </View>
  );
}

// A compact figure: icon badge on the left, small label over the value.
function Kpi({
  icon,
  tint,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  tint?: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  const accent = tint ?? colors.primary;
  const content = (
    <>
      <View style={[styles.kpiIcon, { backgroundColor: iconBadge(accent) }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <View style={styles.kpiText}>
        <Text style={styles.kpiLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.kpiValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={[styles.kpiCell, styles.kpi]}>{content}</View>;
  return (
    <PressableScale
      haptic="tap"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.kpiCell, styles.kpi, pressed && styles.pressed]}>
      {content}
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  pressed: {
    opacity: 0.7,
  },
  hero: {
    borderRadius: radius.large,
    padding: spacing.four,
    gap: spacing.three,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  heroIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  heroValue: {
    ...typography.title,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroValueOver: {
    color: '#FECACA',
  },
  heroCaption: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  heroFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  heroFillAlert: {
    backgroundColor: '#FCA5A5',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.two,
  },
  heroMeta: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    flexShrink: 1,
  },
  heroMetaStrong: {
    ...typography.captionStrong,
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.two,
  },
  kpiCell: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 0,
  },
  kpi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    borderRadius: radius.medium,
    paddingVertical: spacing.three,
    paddingHorizontal: spacing.three,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiText: {
    flex: 1,
    minWidth: 0,
  },
  kpiLabel: {
    ...typography.micro,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  kpiValue: {
    ...typography.bodyStrong,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  budgetCard: {
    gap: 0,
    paddingVertical: spacing.one,
  },
}));
