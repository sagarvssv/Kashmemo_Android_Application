import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card, Section } from '@/components/card';
import { KpiCard, KpiGrid } from '@/components/kpi-card';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/screen';
import { ProgressBar } from '@/components/stat-tile';
import { ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { dashboardApi } from '@/lib/endpoints';
import { formatMonth } from '@/lib/format';
import { can } from '@/lib/permissions';

import { AdvanceAttentionChips, useAdvanceAttention } from '@/features/advances/advance-attention';

import { AttentionChip, AttentionList, BudgetUsageCard } from './overview-widgets';
import { greetingSubtitle, greetingTitle, NotificationBell } from './shared';
import { TicketStatusChart } from './ticket-status-chart';

const TOP_DEPARTMENTS = 3;

// Home for the CEO and HR, built on /dashboard/summary. It's an overview only:
// ticket lists, activity and department details live in their own tabs and
// screens, and every number here links to the screen behind it.
export function OrgDashboard() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const [month, setMonth] = useState(currentMonth);

  const summary = useApi(() => dashboardApi.summary(month), [month]);
  const advanceWork = useAdvanceAttention();

  useRealtime(['ticket:created', 'ticket:status-update', 'budget:update', 'employee:created'], () => {
    void summary.reload();
  });

  const data = summary.data?.data;
  const monthLabel = formatMonth(month.month, month.year);
  // HR can't open Reports, so "Spent" falls back to the department budgets.
  const spentHref: Href = can.viewReports(user.role) ? '/reports' : '/departments';

  const awaitingApproval = (data?.tickets.PENDING ?? 0) + (data?.tickets.PARTIALLY_APPROVED ?? 0);
  const readyToDisburse = data?.tickets.APPROVED ?? 0;
  const unfunded = data?.departments.filter((department) => !department.hasBudgetSet).length ?? 0;
  const overBudget = data?.departments.filter((department) => department.remaining < 0).length ?? 0;
  const topSpenders = [...(data?.departments ?? [])]
    .filter((department) => department.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, TOP_DEPARTMENTS);

  const allocated = data?.budget.totalAllocatedBudget ?? 0;
  const spent = data?.budget.totalSpent ?? 0;

  return (
    <Screen
      title={greetingTitle(user)}
      subtitle={greetingSubtitle(user)}
      right={<NotificationBell />}
      refreshing={summary.isRefreshing}
      onRefresh={summary.refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      {summary.isLoading && !data ? <LoadingState /> : null}
      {summary.error && !data ? <ErrorState message={summary.error} onRetry={summary.reload} /> : null}

      {data && (
        <>
          <KpiGrid>
            <KpiCard
              icon="wallet-outline"
              tone="teal"
              value={formatMoney(data.budget.totalRemaining)}
              label="Budget remaining"
              link="Budgets"
              href="/departments"
              highlight
            />
            <KpiCard
              icon="trending-up-outline"
              tone="terracotta"
              value={formatMoney(spent)}
              label={`Spent · ${monthLabel}`}
              link={spentHref === '/reports' ? 'Reports' : 'Budgets'}
              href={spentHref}
            />
            <KpiCard
              icon="pie-chart-outline"
              tone="indigo"
              value={formatMoney(allocated)}
              label={`Allocated · ${data.totalDepartments} departments`}
              link="Allocate"
              href="/departments"
            />
            <KpiCard
              icon="people-outline"
              tone="blue"
              value={String(data.totalEmployees)}
              label="Employees"
              link="People"
              href="/people"
            />
          </KpiGrid>

          <BudgetUsageCard allocated={allocated} spent={spent} monthLabel={monthLabel} />

          <AttentionList>
            <AttentionChip
              icon="time-outline"
              count={awaitingApproval}
              label="awaiting approval"
              href={{ pathname: '/tickets', params: { scope: 'all', status: 'PENDING' } }}
            />
            <AttentionChip
              icon="cash-outline"
              count={readyToDisburse}
              label="ready to disburse"
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
            <AdvanceAttentionChips attention={advanceWork} />
          </AttentionList>

          <Section title="Tickets this month">
            <TicketStatusChart
              counts={data.tickets}
              onOpenStatus={(status) => router.push({ pathname: '/tickets', params: { scope: 'all', status } })}
            />
          </Section>

          {topSpenders.length > 0 && (
            <Section title="Top spending departments" action={{ label: 'All', onPress: () => router.push('/departments') }}>
              <Card style={styles.top}>
                {topSpenders.map((department) => (
                  <PressableScale
                    key={department.departmentId.id}
                    onPress={() =>
                      router.push({ pathname: '/department/[id]', params: { id: department.departmentId.id } })
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}>
                    <View style={styles.topHeader}>
                      <Text style={styles.topName} numberOfLines={1}>
                        {department.departmentId.name}
                      </Text>
                      <Text style={[styles.topAmount, department.remaining < 0 && styles.danger]}>
                        {formatMoney(department.spent)}
                        {department.hasBudgetSet ? (
                          <Text style={styles.topOf}> / {formatMoney(department.totalAllocated)}</Text>
                        ) : null}
                      </Text>
                    </View>
                    <ProgressBar value={department.spent} max={department.totalAllocated} />
                  </PressableScale>
                ))}
              </Card>
            </Section>
          )}
        </>
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  pressed: {
    opacity: 0.7,
  },
  danger: {
    color: colors.danger,
  },
  top: {
    gap: spacing.one,
    paddingVertical: spacing.two,
  },
  topRow: {
    gap: 6,
    paddingVertical: spacing.two,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.two,
  },
  topName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  topOf: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
}));
