import { router } from 'expo-router';
import React, { useState } from 'react';

import { Card, Section } from '@/components/card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { AdvanceShortcuts, useAdvanceAttention } from '@/features/advances/advance-attention';
import { useApi } from '@/hooks/use-api';
import { departmentApi, managerApi, ticketApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';

import {
  DepartmentBudgetRow,
  greetingLine,
  greetingTitle,
  HomeAvatar,
  HomeMeta,
  NotificationBell,
  RaiseTicketButton,
  TicketPreviewList,
} from './shared';

// Manager Home, same layout as the iOS app's (in this app's colours and
// wording): the month's budget across the departments they manage, the bills
// waiting for them, and each department's budget.
export function ManagerDashboard() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);

  // Every department the manager handles (primary first).
  const departments = useApi(
    () =>
      managerApi
        .departments(user.userId)
        .then((r) => [...r.data].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))),
    [user.userId],
  );
  const departmentIds = (departments.data ?? []).map((department) => department.id);
  const budgets = useApi(
    () => Promise.all(departmentIds.map((id) => departmentApi.budgetStatus(id, month).then((r) => r.data))),
    [departmentIds.join(','), month],
  );
  const pending = useApi(() => ticketApi.department({ status: 'PENDING', limit: 5 }), []);
  const advanceWork = useAdvanceAttention();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update'], () => {
    void pending.reload();
    void budgets.reload();
  });

  const refresh = async () => {
    await Promise.all([departments.refresh(), budgets.refresh(), pending.refresh(), advanceWork.refresh()]);
  };

  const budgetList = budgets.data ?? [];
  const budgeted = budgetList.filter((status) => status.hasBudgetSet);
  const allocated = budgeted.reduce((sum, status) => sum + toAmount(status.totalAllocated), 0);
  const spent = budgeted.reduce((sum, status) => sum + toAmount(status.spent), 0);
  const remaining = budgeted.reduce((sum, status) => sum + toAmount(status.remaining), 0);
  const budgetsLoading = (departments.isLoading || budgets.isLoading) && !budgets.data;
  const budgetsError = departments.error ?? budgets.error;
  const pendingCount = pending.data?.data.length ?? 0;

  return (
    <Screen
      overline={greetingLine()}
      title={greetingTitle(user)}
      leading={<HomeAvatar />}
      meta={<HomeMeta />}
      right={<NotificationBell />}
      refreshing={departments.isRefreshing || pending.isRefreshing}
      onRefresh={refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      <StatGrid>
        <StatTile label="Remaining" value={formatMoney(remaining)} icon="wallet-outline" tone="highlight" />
        <StatTile label="Spent" value={formatMoney(spent)} icon="trending-up-outline" />
        <StatTile label="Allocated" value={formatMoney(allocated)} icon="pie-chart-outline" />
        <StatTile
          label="Waiting for you"
          value={pending.data ? `${pendingCount}${pending.data.nextCursor ? '+' : ''}` : '—'}
          icon="hourglass-outline"
          onPress={() => router.push({ pathname: '/tickets', params: { scope: 'team', status: 'PENDING' } })}
        />
      </StatGrid>

      <RaiseTicketButton />

      <AdvanceShortcuts attention={advanceWork} />

      <Section title="Department budgets" collapsible>
        <Card style={styles.budgets}>
          {budgetsError && !budgets.data ? (
            <ErrorState message={budgetsError} onRetry={departments.data ? budgets.reload : departments.reload} />
          ) : null}
          {budgetsLoading && !budgetsError ? <LoadingState rows={2} /> : null}
          {budgets.data && budgetList.length === 0 ? (
            <EmptyState icon="business-outline" title="You don't manage any departments yet" />
          ) : null}
          {budgetList.map((status, index) => (
            <DepartmentBudgetRow key={status.departmentId.id} status={status} first={index === 0} />
          ))}
        </Card>
      </Section>

      <TicketPreviewList
        title="Waiting for your approval"
        collapsible
        tickets={pending.data?.data}
        emptyTitle={pending.error ?? (pending.isLoading ? 'Loading…' : 'No bills waiting in your department')}
        onSeeAll={() => router.push({ pathname: '/tickets', params: { scope: 'team', status: 'PENDING' } })}
      />
    </Screen>
  );
}

const useStyles = createStyles(() => ({
  budgets: {
    gap: 0,
    paddingVertical: spacing.one,
  },
}));
