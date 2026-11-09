import { router } from 'expo-router';
import React, { useState } from 'react';

import { Section } from '@/components/card';
import { KpiCard, KpiGrid } from '@/components/kpi-card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/states';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { useApi } from '@/hooks/use-api';
import { departmentApi, employeeApi, managerApi, ticketApi } from '@/lib/endpoints';
import { formatMonth, toAmount } from '@/lib/format';

import { AdvanceAttentionChips, useAdvanceAttention } from '@/features/advances/advance-attention';

import { MyMoneySection, useMyMoney } from './my-money';
import { AttentionChip, AttentionList } from './overview-widgets';
import { BudgetCard, greetingSubtitle, greetingTitle, NotificationBell, RaiseTicketButton, TicketPreviewList } from './shared';

// Enough tickets to count a team's queue in one request.
const COUNT_LIMIT = 50;
// The approval queue on Home shows only the oldest few; the rest are a tap away.
const PREVIEW_COUNT = 3;

// Manager home, in the same overview style as the Finance and CEO screens:
// four tappable headline numbers, what needs the manager now, then each
// department's budget for the month. Ticket lists and activity live in their
// own tabs, so Home stays short.
export function ManagerDashboard() {
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);

  const departments = useApi(() => managerApi.departments(user.userId), [user.userId]);
  const departmentIds = (departments.data?.data ?? []).map((department) => department.id);
  const budgets = useApi(
    () => Promise.all(departmentIds.map((id) => departmentApi.budgetStatus(id, month).then((r) => r.data))),
    [departmentIds.join(','), month],
  );
  const team = useApi(
    async () => {
      const lists = await Promise.all(departmentIds.map((id) => employeeApi.inDepartment(id).then((r) => r.data)));
      // Someone in two of the manager's departments is counted once.
      return new Set(lists.flat().map((employee) => employee.id)).size;
    },
    [departmentIds.join(',')],
  );
  const pending = useApi(() => ticketApi.department({ status: 'PENDING', limit: COUNT_LIMIT }), []);
  const approved = useApi(() => ticketApi.department({ status: 'APPROVED', limit: COUNT_LIMIT }), []);
  const advanceWork = useAdvanceAttention();
  // Managers raise advances and claims too; their own money shows here.
  const myMoney = useMyMoney();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update'], () => {
    void pending.reload();
    void approved.reload();
    void budgets.reload();
  });
  useRealtime(['employee:created', 'employee:update'], () => {
    void team.reload();
  });

  const refresh = async () => {
    await Promise.all([
      departments.refresh(),
      pending.refresh(),
      approved.refresh(),
      budgets.refresh(),
      team.refresh(),
      advanceWork.refresh(),
      myMoney.refresh(),
    ]);
  };

  const pendingList = pending.data?.data ?? [];
  const pendingCount = pending.data?.nextCursor ? `${COUNT_LIMIT}+` : String(pendingList.length);
  const pendingAmount = pendingList.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  // Oldest first: they've waited longest.
  const queue = [...pendingList].reverse().slice(0, PREVIEW_COUNT);
  const approvedList = approved.data?.data ?? [];
  const approvedCount = approved.data?.nextCursor ? `${COUNT_LIMIT}+` : String(approvedList.length);
  const approvedAmount = approvedList.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);

  const statuses = budgets.data ?? [];
  const remaining = statuses.reduce((sum, status) => sum + toAmount(status.remaining), 0);
  const overBudgetList = statuses.filter((status) => status.hasBudgetSet && toAmount(status.remaining) < 0);
  const unfundedList = statuses.filter((status) => !status.hasBudgetSet);
  const overBudget = overBudgetList.length;
  const unfunded = unfundedList.length;
  // A warning opens the (first) department it is about.
  const departmentHref = (id: string | undefined) =>
    id ? ({ pathname: '/department/[id]', params: { id } } as const) : ({ pathname: '/tickets', params: { scope: 'team' } } as const);
  const monthLabel = formatMonth(month.month, month.year);
  const firstDepartment = departments.data?.data.find((d) => d.isPrimary) ?? departments.data?.data[0];

  return (
    <Screen
      title={greetingTitle(user)}
      subtitle={greetingSubtitle(user)}
      right={<NotificationBell />}
      refreshing={departments.isRefreshing || pending.isRefreshing}
      onRefresh={refresh}>
      <KpiGrid>
        <KpiCard
          icon="time-outline"
          tone="indigo"
          value={pendingCount}
          label="Waiting for your approval"
          link="Review"
          href={{ pathname: '/tickets', params: { scope: 'team', status: 'PENDING' } }}
          highlight
        />
        <KpiCard
          icon="checkmark-done-outline"
          tone="teal"
          value={approvedCount}
          label="Approved · to be paid"
          link="View"
          href={{ pathname: '/tickets', params: { scope: 'team', status: 'APPROVED' } }}
        />
        <KpiCard
          icon="wallet-outline"
          tone="blue"
          value={budgets.data ? formatMoney(remaining) : '—'}
          label={`Budget left · ${monthLabel}`}
          link={departmentIds.length > 1 ? `${departmentIds.length} departments` : 'Budget'}
          href={
            departmentIds.length > 1 || !firstDepartment
              ? '/departments'
              : { pathname: '/department/[id]', params: { id: firstDepartment.id } }
          }
        />
        <KpiCard
          icon="people-outline"
          tone="terracotta"
          value={team.data === undefined ? '—' : String(team.data)}
          label="People in your team"
          link="People"
          href="/people"
        />
      </KpiGrid>

      <RaiseTicketButton />

      <MyMoneySection money={myMoney} />

      {overBudget > 0 || unfunded > 0 || approvedList.length > 0 || advanceWork.bills.length > 0 ? (
        <AttentionList>
          <AdvanceAttentionChips attention={advanceWork} />
          {overBudget > 0 && (
            <AttentionChip
              icon="alert-circle-outline"
              count={overBudget}
              label={overBudget === 1 ? `${overBudgetList[0].departmentId.name} is over budget` : 'departments over budget'}
              href={departmentHref(overBudgetList[0]?.departmentId.id)}
              danger
            />
          )}
          {unfunded > 0 && (
            <AttentionChip
              icon="business-outline"
              count={unfunded}
              label={
                unfunded === 1
                  ? `${unfundedList[0].departmentId.name} has no budget for ${monthLabel}`
                  : `departments have no budget for ${monthLabel}`
              }
              href={departmentHref(unfundedList[0]?.departmentId.id)}
            />
          )}
          {approvedList.length > 0 && (
            <AttentionChip
              icon="cash-outline"
              count={approvedCount}
              label="approved, waiting for payout"
              detail={formatMoney(approvedAmount)}
              href={{ pathname: '/tickets', params: { scope: 'team', status: 'APPROVED' } }}
            />
          )}
        </AttentionList>
      ) : null}

      <TicketPreviewList
        title={pendingList.length ? `Needs your approval · ${formatMoney(pendingAmount)}` : 'Needs your approval'}
        tickets={queue}
        emptyTitle={pending.error ?? 'All caught up. Nothing waiting for you.'}
        onSeeAll={
          pendingList.length > PREVIEW_COUNT
            ? () => router.push({ pathname: '/tickets', params: { scope: 'team', status: 'PENDING' } })
            : undefined
        }
      />

      <Section title="Department budgets">
        <MonthSwitcher value={month} onChange={setMonth} />
        {departments.error ? <ErrorState message={departments.error} onRetry={departments.reload} /> : null}
        {budgets.isLoading && !budgets.data && departmentIds.length > 0 ? <LoadingState rows={1} /> : null}
        {statuses.map((status) => (
          <BudgetCard
            key={status.departmentId.id}
            status={status}
            onPress={() => router.push({ pathname: '/department/[id]', params: { id: status.departmentId.id } })}
          />
        ))}
      </Section>
    </Screen>
  );
}
