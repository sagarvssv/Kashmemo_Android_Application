import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { BudgetCard } from '@/features/dashboard/shared';
import { useApi } from '@/hooks/use-api';
import { departmentApi, managerApi } from '@/lib/endpoints';

// Every department's budget for the month. A Manager sees only the
// departments they manage (primary first), opened from Home.
export default function DepartmentsScreen() {
  const formatMoney = useFormatMoney();
  const user = useCurrentUser();
  const isManager = user.role === 'MANAGER';
  const [month, setMonth] = useState(currentMonth);

  const statuses = useApi(async () => {
    const departments = isManager
      ? [...(await managerApi.departments(user.userId)).data].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      : (await departmentApi.list()).data;
    return Promise.all(departments.map((department) => departmentApi.budgetStatus(department.id, month).then((r) => r.data)));
  }, [month, isManager, user.userId]);

  useRealtime(['budget:update', 'ticket:status-update'], () => {
    void statuses.reload();
  });

  const list = statuses.data ?? [];
  const allocated = list.reduce((sum, status) => sum + status.totalAllocated, 0);
  const spent = list.reduce((sum, status) => sum + status.spent, 0);
  const remaining = list.reduce((sum, status) => sum + status.remaining, 0);

  return (
    <Screen
      title={isManager ? 'My departments' : 'Departments & budgets'}
      subtitle={isManager && list.length > 0 ? `You manage ${list.length === 1 ? '1 department' : `${list.length} departments`}` : undefined}
      backFallback={isManager ? '/home' : '/profile'}
      refreshing={statuses.isRefreshing}
      onRefresh={statuses.refresh}>
      <MonthSwitcher value={month} onChange={setMonth} />

      {statuses.isLoading && !statuses.data ? <LoadingState /> : null}
      {statuses.error && !statuses.data ? <ErrorState message={statuses.error} onRetry={statuses.reload} /> : null}

      {statuses.data && (
        <>
          <StatGrid>
            <StatTile label="Allocated" value={formatMoney(allocated)} icon="pie-chart-outline" tone="highlight" />
            <StatTile label="Spent" value={formatMoney(spent)} icon="trending-up-outline" />
            {isManager ? <StatTile label="Left" value={formatMoney(remaining)} icon="wallet-outline" /> : null}
          </StatGrid>
          {list.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="No departments yet"
              message={isManager ? 'Ask your admin to assign you a department.' : 'Departments are created when you add employees.'}
            />
          ) : (
            <View style={styles.list}>
              {list.map((status) => (
                <BudgetCard
                  key={status.departmentId.id}
                  status={status}
                  onPress={() =>
                    router.push({
                      pathname: '/department/[id]',
                      params: { id: status.departmentId.id, month: String(month.month), year: String(month.year) },
                    })
                  }
                />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.three,
  },
});
