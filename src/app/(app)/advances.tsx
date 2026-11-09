import { Redirect } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { Section } from '@/components/card';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { AdvanceCard } from '@/features/advances/advance-ui';
import { useApi } from '@/hooks/use-api';
import { advanceApi } from '@/lib/endpoints';
import { formatDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { OutstandingAdvance } from '@/lib/types';

// Advances whose cash is out: waiting to settle first (finance acts on
// those), then those still being spent. Each opens the advance, where the
// Finance Manager settles it.
export default function AdvancesRoute() {
  const user = useCurrentUser();
  if (!can.viewOutstandingAdvances(user.role)) return <Redirect href="/home" />;
  return <AdvancesScreen />;
}

function AdvancesScreen() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const advances = useApi(() => advanceApi.outstanding().then((r) => r.data), []);

  useRealtime(['ticket:status-update', 'ticket:created'], () => {
    void advances.reload();
  });

  const list = advances.data ?? [];
  const toSettle = list.filter((advance) => advance.status === 'SETTLEMENT_PENDING');
  const spending = list.filter((advance) => advance.status === 'DISBURSED');
  const toCollect = toSettle.reduce((sum, advance) => sum + advance.toReturn, 0);
  const toPay = toSettle.reduce((sum, advance) => sum + advance.toPay, 0);
  const cashOut = spending.reduce((sum, advance) => sum + advance.toReturn, 0);

  return (
    <Screen
      title="Advances"
      subtitle="Cash given out and not yet settled"
      backFallback="/home"
      refreshing={advances.isRefreshing}
      onRefresh={advances.refresh}>
      {advances.isLoading && !advances.data ? <LoadingState /> : null}
      {advances.error && !advances.data ? <ErrorState message={advances.error} onRetry={advances.reload} /> : null}

      {advances.data ? (
        <>
          <StatGrid>
            <StatTile label="To collect at settlement" value={formatMoney(toCollect)} icon="arrow-down-circle-outline" tone="highlight" />
            <StatTile label="To pay at settlement" value={formatMoney(toPay)} icon="arrow-up-circle-outline" />
            <StatTile label="Still being spent" value={formatMoney(cashOut)} icon="time-outline" />
          </StatGrid>

          {list.length === 0 ? <EmptyState icon="checkmark-done-outline" title="No advances out right now" /> : null}

          {toSettle.length > 0 ? (
            <Section title={`Ready to settle (${toSettle.length})`}>
              <View style={styles.list}>
                {toSettle.map((advance) => (
                  <OutstandingCard key={advance.id} advance={advance} />
                ))}
              </View>
            </Section>
          ) : null}

          {spending.length > 0 ? (
            <Section title={`Still spending (${spending.length})`}>
              <View style={styles.list}>
                {spending.map((advance) => (
                  <OutstandingCard key={advance.id} advance={advance} />
                ))}
              </View>
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function OutstandingCard({ advance }: { advance: OutstandingAdvance }) {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const ready = advance.status === 'SETTLEMENT_PENDING';
  const who = advance.employee?.name ?? 'Employee';
  return (
    <AdvanceCard
      id={advance.id}
      purpose={advance.purpose}
      amount={advance.amount}
      spentAmount={advance.spentAmount}
      status={advance.status}
      subtitle={[who, advance.department.name, advance.disbursedAt ? `cash given ${formatDate(advance.disbursedAt)}` : null]
        .filter(Boolean)
        .join(' · ')}
      pendingBills={advance.pendingBills}
      footer={
        ready ? (
          <Text style={[styles.action, { color: advance.toPay > 0 ? colors.danger : colors.success }]}>
            {advance.pendingBills > 0
              ? `Review ${advance.pendingBills === 1 ? 'the waiting bill' : `${advance.pendingBills} waiting bills`} before settling`
              : advance.toReturn > 0
                ? `Collect ${formatMoney(advance.toReturn)} from ${who}, then settle`
                : advance.toPay > 0
                  ? `Pay ${formatMoney(advance.toPay)} to ${who}, then settle`
                  : 'Fully spent. Settle to close it'}
          </Text>
        ) : undefined
      }
    />
  );
}

const useStyles = createStyles(() => ({
  list: {
    gap: spacing.three,
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
  },
}));
