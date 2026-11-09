import { router } from 'expo-router';
import React, { useState } from 'react';

import { Section } from '@/components/card';
import { KpiCard, KpiGrid } from '@/components/kpi-card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { useApi } from '@/hooks/use-api';
import { dashboardApi, departmentApi, ticketApi } from '@/lib/endpoints';
import { formatMonth, toAmount } from '@/lib/format';

import { BudgetSpendChart, type DepartmentSpend } from './budget-spend-chart';
import { AdvanceAttentionChips, useAdvanceAttention } from '@/features/advances/advance-attention';

import { AttentionChip, AttentionList, BudgetUsageCard } from './overview-widgets';
import { greetingSubtitle, greetingTitle, NotificationBell, RaiseTicketButton } from './shared';

// How many departments the allocated-vs-spent chart shows on Home.
const CHART_DEPARTMENTS = 4;
// Approved tickets are only counted, so fetch enough to count them in one go.
const APPROVED_COUNT_LIMIT = 50;

// Finance Manager home, styled after the Finance Manager web dashboard. It's
// an overview: ticket lists and activity live in their own tabs, and every
// number links to the screen behind it. The role can't read
// /dashboard/summary, so it combines the department list, each department's
// budget status (allocated vs approved + disbursed spend) and ticket endpoints.
export function FinanceDashboard() {
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);

  const spend = useApi(async () => {
    const { data: departments } = await departmentApi.list();
    const statuses = await Promise.all(
      departments.map((department) => departmentApi.budgetStatus(department.id, month).then((r) => r.data)),
    );
    return departments.map(
      (department, index): DepartmentSpend & { funded: boolean } => ({
        id: department.id,
        name: department.name,
        allocated: toAmount(statuses[index]?.totalAllocated),
        spent: toAmount(statuses[index]?.spent),
        funded: Boolean(statuses[index]?.hasBudgetSet),
      }),
    );
  }, [month]);
  const pending = useApi(() => dashboardApi.pendingTickets(month), [month]);
  const approved = useApi(() => ticketApi.organization({ status: 'APPROVED', limit: APPROVED_COUNT_LIMIT }), []);
  const advanceWork = useAdvanceAttention();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update'], () => {
    void spend.reload();
    void pending.reload();
    void approved.reload();
  });

  const refresh = async () => {
    await Promise.all([spend.refresh(), pending.refresh(), approved.refresh(), advanceWork.refresh()]);
  };

  const rows = spend.data ?? [];
  const totalAllocated = rows.reduce((sum, row) => sum + row.allocated, 0);
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  const funded = rows.filter((row) => row.funded).length;
  const overBudget = rows.filter((row) => row.allocated > 0 && row.spent > row.allocated).length;
  const unfunded = rows.length - funded;

  const pendingList = pending.data?.data ?? [];
  const pendingAmount = pendingList.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const approvedList = approved.data?.data ?? [];
  const approvedAmount = approvedList.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const approvedCount = approved.data?.nextCursor ? `${APPROVED_COUNT_LIMIT}+` : approvedList.length;

  // Busiest departments first: by spend, then by allocation.
  const chartRows = [...rows]
    .filter((row) => row.allocated > 0 || row.spent > 0)
    .sort((a, b) => b.spent - a.spent || b.allocated - a.allocated)
    .slice(0, CHART_DEPARTMENTS);
  const monthLabel = formatMonth(month.month, month.year);

  return (
    <Screen
      title={greetingTitle(user)}
      subtitle={greetingSubtitle(user)}
      right={<NotificationBell />}
      refreshing={spend.isRefreshing}
      onRefresh={refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      <KpiGrid>
        <KpiCard
          icon="wallet-outline"
          tone="teal"
          value={formatMoney(totalAllocated)}
          label={`Allocated · ${monthLabel}`}
          link="View budgets"
          href="/departments"
          highlight
        />
        <KpiCard
          icon="business-outline"
          tone="terracotta"
          value={rows.length ? `${funded}/${rows.length}` : '—'}
          label="Departments funded"
          link="Manage budgets"
          href="/departments"
        />
        <KpiCard
          icon="time-outline"
          tone="indigo"
          value={String(pendingList.length)}
          label="Pending approvals"
          link="View approvals"
          href={{ pathname: '/tickets', params: { scope: 'all', status: 'PENDING' } }}
        />
        <KpiCard
          icon="trending-up-outline"
          tone="blue"
          value={formatMoney(totalSpent)}
          label={`Spent · ${monthLabel}`}
          link="Reports"
          href="/reports"
        />
      </KpiGrid>

      <RaiseTicketButton />

      <AttentionList>
        <AdvanceAttentionChips attention={advanceWork} />
        <AttentionChip
          icon="time-outline"
          count={pendingList.length}
          label="awaiting approval"
          detail={pendingList.length ? formatMoney(pendingAmount) : undefined}
          href={{ pathname: '/tickets', params: { scope: 'all', status: 'PENDING' } }}
        />
        <AttentionChip
          icon="cash-outline"
          count={approvedCount}
          label="ready to disburse"
          detail={approvedList.length ? formatMoney(approvedAmount) : undefined}
          href={{ pathname: '/tickets', params: { scope: 'all', status: 'APPROVED' } }}
        />
        {overBudget > 0 && (
          <AttentionChip
            icon="alert-circle-outline"
            count={overBudget}
            label={overBudget === 1 ? 'department over budget' : 'departments over budget'}
            href="/departments"
            danger
          />
        )}
        {unfunded > 0 && (
          <AttentionChip
            icon="business-outline"
            count={unfunded}
            label={unfunded === 1 ? 'department without budget' : 'departments without budget'}
            href="/departments"
          />
        )}
      </AttentionList>

      <BudgetUsageCard allocated={totalAllocated} spent={totalSpent} monthLabel={monthLabel} />

      <Section
        title="Allocated vs. spent"
        action={rows.length > CHART_DEPARTMENTS ? { label: `All ${rows.length}`, onPress: () => router.push('/departments') } : undefined}>
        {spend.isLoading && !spend.data ? <LoadingState /> : null}
        {spend.error && !spend.data ? <ErrorState message={spend.error} onRetry={spend.reload} /> : null}
        {spend.data && chartRows.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title={`No budgets or spend in ${monthLabel}`} />
        ) : null}
        {chartRows.length > 0 && (
          <BudgetSpendChart
            rows={chartRows}
            onOpenDepartment={(id) => router.push({ pathname: '/department/[id]', params: { id } })}
          />
        )}
      </Section>
    </Screen>
  );
}
