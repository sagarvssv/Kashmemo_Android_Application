import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ListRow, Section } from '@/components/card';
import { currentMonth, MonthSwitcher, type MonthValue } from '@/components/month-switcher';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { TicketRow } from '@/components/ticket-row';
import { spacing } from '@/constants/theme';
import { useCurrentUser, useRealtime } from '@/context/session';
import { BudgetCard } from '@/features/dashboard/shared';
import { useApi } from '@/hooks/use-api';
import { departmentApi, employeeApi, ticketApi } from '@/lib/endpoints';
import { formatMonth, ROLE_LABELS, toAmount } from '@/lib/format';
import { can } from '@/lib/permissions';

export default function DepartmentDetailScreen() {
  const params = useLocalSearchParams<{ id: string; month?: string; year?: string }>();
  const user = useCurrentUser();
  const [month, setMonth] = useState<MonthValue>(() =>
    params.month && params.year ? { month: Number(params.month), year: Number(params.year) } : currentMonth(),
  );
  const [isAllocating, setIsAllocating] = useState(false);

  const status = useApi(() => departmentApi.budgetStatus(params.id, month).then((r) => r.data), [params.id, month]);
  const currentBudget = useApi(() => departmentApi.budget(params.id, month).then((r) => r.data), [params.id, month]);
  const employees = useApi(() => employeeApi.inDepartment(params.id).then((r) => r.data), [params.id]);
  // HR can't list department tickets on the backend. A Manager only reaches
  // departments they manage (from My departments).
  const canSeeTickets = user.role === 'CEO' || user.role === 'FINANCE_MANAGER' || user.role === 'MANAGER';
  const tickets = useApi(
    () =>
      canSeeTickets
        ? ticketApi.department({ departmentId: params.id, limit: 5 }).then((r) => r.data)
        : Promise.resolve([]),
    [params.id, canSeeTickets],
  );

  useRealtime(['budget:update', 'ticket:status-update', 'ticket:created'], () => {
    void status.reload();
    void currentBudget.reload();
    void tickets.reload();
  });

  const refresh = async () => {
    await Promise.all([status.refresh(), currentBudget.refresh(), employees.refresh(), tickets.refresh()]);
  };

  const name = status.data?.departmentId.name ?? 'Department';

  return (
    <Screen title={name} backFallback="/departments" refreshing={status.isRefreshing} onRefresh={refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      {status.isLoading && !status.data ? <LoadingState /> : null}
      {status.error && !status.data ? <ErrorState message={status.error} onRetry={status.reload} /> : null}
      {status.data && <BudgetCard status={status.data} />}

      {can.allocateBudget(user.role) && (
        <PrimaryButton
          label={status.data?.hasBudgetSet ? 'Update budget' : 'Allocate budget'}
          icon="pie-chart-outline"
          variant="secondary"
          onPress={() => setIsAllocating(true)}
        />
      )}

      {canSeeTickets && (
        <Section title="Recent tickets">
          {tickets.data && tickets.data.length > 0 ? (
            <View style={styles.list}>
              {tickets.data.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState icon="receipt-outline" title={tickets.error ?? 'No tickets yet'} />
            </Card>
          )}
        </Section>
      )}

      <Section title={`People (${employees.data?.length ?? 0})`}>
        <Card style={styles.rows}>
          {employees.error ? <ErrorState message={employees.error} onRetry={employees.reload} /> : null}
          {!employees.error && employees.data?.length === 0 ? <EmptyState icon="people-outline" title="No one here yet" /> : null}
          {(employees.data ?? []).map((employee) => (
            <ListRow
              key={employee.id}
              icon="person-outline"
              title={employee.name}
              subtitle={[ROLE_LABELS[employee.role], employee.designation].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/employee/[id]', params: { id: employee.id } })}
            />
          ))}
        </Card>
      </Section>

      <PromptModal
        visible={isAllocating}
        title={`Budget for ${formatMonth(month.month, month.year)}`}
        message={`Set the total ${name} can spend this month. Re-allocating replaces the existing amount.`}
        fields={[
          {
            key: 'amount',
            label: 'Amount',
            keyboardType: 'decimal-pad',
            initialValue: currentBudget.data ? String(toAmount(currentBudget.data.amount)) : '',
          },
        ]}
        confirmLabel="Save budget"
        onClose={() => setIsAllocating(false)}
        onSubmit={async ({ amount }) => {
          const parsed = Number(amount.replace(/,/g, ''));
          if (!Number.isFinite(parsed) || parsed < 1) throw new Error('Enter an amount of at least 1.');
          await departmentApi.allocateBudget({ departmentId: params.id, amount: parsed, ...month });
          await Promise.all([status.reload(), currentBudget.reload()]);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.three,
  },
  rows: {
    gap: 0,
    paddingVertical: spacing.one,
  },
});
