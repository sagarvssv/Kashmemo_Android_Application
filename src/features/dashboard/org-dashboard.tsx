import { router } from 'expo-router';
import React, { useState } from 'react';

import { Card, Section } from '@/components/card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { AdvanceShortcuts, useAdvanceAttention } from '@/features/advances/advance-attention';
import { useApi } from '@/hooks/use-api';
import { dashboardApi, ticketApi } from '@/lib/endpoints';
import { can } from '@/lib/permissions';

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
import { StatusDonut } from './status-donut';

// Home for the CEO and HR, built on /dashboard/summary. Same layout as the iOS
// app's Home, section for section, in this app's colours and wording.
export function OrgDashboard() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);
  const [refreshToken, setRefreshToken] = useState(0);

  const summary = useApi(() => dashboardApi.summary(month), [month]);
  const pending = useApi(
    () =>
      can.viewPendingTickets(user.role)
        ? dashboardApi.pendingTickets(month).then((r) => r.data.slice(0, 5))
        : ticketApi.organization({ status: 'PENDING', limit: 5 }).then((r) => r.data),
    [month, user.role],
  );
  const toDisburse = useApi(() => ticketApi.organization({ status: 'APPROVED', limit: 5 }), []);
  const advanceWork = useAdvanceAttention();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update', 'employee:created'], () => {
    void summary.reload();
    void pending.reload();
    void toDisburse.reload();
  });

  const refresh = async () => {
    setRefreshToken((token) => token + 1);
    await Promise.all([summary.refresh(), pending.refresh(), toDisburse.refresh(), advanceWork.refresh()]);
  };

  const data = summary.data?.data;

  return (
    <Screen
      overline={greetingLine()}
      title={greetingTitle(user)}
      leading={<HomeAvatar />}
      meta={<HomeMeta />}
      right={<NotificationBell />}
      refreshing={summary.isRefreshing}
      onRefresh={refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      {summary.isLoading && !data ? <LoadingState /> : null}
      {summary.error && !data ? <ErrorState message={summary.error} onRetry={summary.reload} /> : null}

      {data && (
        <>
          <StatGrid>
            <StatTile
              label="Budget remaining"
              value={formatMoney(data.budget.totalRemaining)}
              icon="wallet-outline"
              tone="highlight"
              onPress={() => router.push('/departments')}
            />
            <StatTile label="Spent" value={formatMoney(data.budget.totalSpent)} icon="trending-up-outline" />
            <StatTile label="Allocated" value={formatMoney(data.budget.totalAllocatedBudget)} icon="pie-chart-outline" />
            <StatTile
              label="Employees"
              value={String(data.totalEmployees)}
              icon="people-outline"
              onPress={() => router.push('/people')}
            />
          </StatGrid>

          <Section title="Bills this month">
            <StatusDonut
              counts={data.tickets}
              onOpenStatus={(status) => router.push({ pathname: '/tickets', params: { scope: 'all', status } })}
            />
          </Section>

          {data.departments.length > 0 && (
            <Section
              title={`Departments (${data.totalDepartments})`}
              collapsible
              action={{ label: 'Manage', onPress: () => router.push('/departments') }}>
              <Card style={styles.departments}>
                {data.departments.map((status, index) => (
                  <DepartmentBudgetRow key={status.departmentId.id} status={status} first={index === 0} />
                ))}
              </Card>
            </Section>
          )}
        </>
      )}

      <DailyReportShortcut />

      <AdvanceShortcuts attention={advanceWork} />

      <DepartmentTicketsPreview refreshToken={refreshToken} />

      <RaiseTicketButton />

      <TicketPreviewList
        title="Waiting for your approval"
        collapsible
        tickets={pending.data}
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

const useStyles = createStyles(() => ({
  departments: {
    gap: 0,
    paddingVertical: spacing.one,
  },
}));
