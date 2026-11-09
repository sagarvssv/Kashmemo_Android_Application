import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Segmented } from '@/components/chip-group';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { TicketRow } from '@/components/ticket-row';
import { radius, spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles } from '@/context/theme';
import { AdvanceCard, WalletTxnRow } from '@/features/advances/advance-ui';
import { useApi } from '@/hooks/use-api';
import { ticketApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { TicketStatus } from '@/lib/types';

// advances: cash out on advances · collect: approved, cash not collected yet ·
// history: every money movement (the wallet ledger).
type Tab = 'advances' | 'collect' | 'history';
const TABS: Tab[] = ['advances', 'collect', 'history'];

// Tickets still waiting for approval aren't in the wallet; they're counted
// from the user's own list so the screen can say how much is on its way.
const WAITING: TicketStatus[] = ['PENDING', 'PARTIALLY_APPROVED'];
const WAITING_LIMIT = 100;

// The CEO has no wallet (see can.viewWallet); send them home if they land here.
export default function WalletRoute() {
  const user = useCurrentUser();
  if (!can.viewWallet(user.role)) return <Redirect href="/home" />;
  return <WalletScreen />;
}

function WalletScreen() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  // Home's money tiles open the matching tab (?tab=advances|collect|history).
  const params = useLocalSearchParams<{ tab?: string }>();
  const requestedTab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'advances';
  const [tab, setTab] = useState<Tab>(requestedTab);
  // Opening the wallet again from another tile switches to that tab
  // (adjusting state during render rather than in an effect).
  const [appliedTab, setAppliedTab] = useState(params.tab);
  if (params.tab !== appliedTab) {
    setAppliedTab(params.tab);
    setTab(requestedTab);
  }
  const wallet = useApi(() => ticketApi.wallet().then((r) => r.data), []);
  const mine = useApi(() => ticketApi.mine({ limit: WAITING_LIMIT }), []);

  useRealtime(['ticket:status-update', 'ticket:created'], () => {
    void wallet.reload();
    void mine.reload();
  });

  const refresh = async () => {
    await Promise.all([wallet.refresh(), mine.refresh()]);
  };

  const data = wallet.data;
  const waitingTotal = (mine.data?.data ?? [])
    .filter((ticket) => WAITING.includes(ticket.status))
    .reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const collectTotal = (data?.awaitingCollection ?? []).reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);

  return (
    <Screen
      title="My wallet"
      subtitle="Cash from advances, and what is owed to you"
      backFallback="/profile"
      refreshing={wallet.isRefreshing || mine.isRefreshing}
      onRefresh={refresh}>
      {wallet.isLoading && !data ? <LoadingState /> : null}
      {wallet.error && !data ? <ErrorState message={wallet.error} onRetry={wallet.reload} /> : null}

      {data && (
        <>
          <BalanceCard balance={data.balance} />

          <StatGrid>
            <StatTile
              label="Waiting for approval"
              value={formatMoney(waitingTotal)}
              icon="hourglass-outline"
              onPress={() => router.push({ pathname: '/tickets', params: { scope: 'mine', status: 'PENDING' } })}
            />
            <StatTile
              label="Approved · collect from finance"
              value={formatMoney(collectTotal)}
              icon="cash-outline"
              onPress={() => setTab('collect')}
            />
          </StatGrid>

          <Segmented
            options={[
              { value: 'advances', label: `Advances (${data.openAdvances.length})` },
              { value: 'collect', label: `To collect (${data.awaitingCollection.length})` },
              { value: 'history', label: 'History' },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 'advances' ? (
            data.openAdvances.length > 0 ? (
              <View style={styles.list}>
                {data.openAdvances.map((advance) => (
                  <AdvanceCard
                    key={advance.id}
                    id={advance.id}
                    purpose={advance.purpose}
                    amount={advance.amount}
                    spentAmount={advance.spentAmount}
                    status={advance.status}
                    subtitle={advance.department?.name}
                    pendingBills={advance.bills.filter((bill) => bill.status === 'PENDING').length}
                  />
                ))}
              </View>
            ) : (
              <EmptyState icon="wallet-outline" title="No open advances" />
            )
          ) : null}

          {tab === 'collect' ? (
            data.awaitingCollection.length > 0 ? (
              <View style={styles.list}>
                <Text style={styles.hint}>Approved. Go to finance to collect this cash.</Text>
                {data.awaitingCollection.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={{ ...ticket, status: 'APPROVED', createdAt: ticket.approvedAt ?? undefined }}
                  />
                ))}
              </View>
            ) : (
              <EmptyState icon="cash-outline" title="Nothing to collect" />
            )
          ) : null}

          {tab === 'history' ? (
            data.transactions.length > 0 ? (
              <Card style={styles.history}>
                {data.transactions.map((txn) => (
                  <WalletTxnRow
                    key={txn.id}
                    txn={txn}
                    onPress={() => router.push({ pathname: '/ticket/[id]', params: { id: txn.ticketId } })}
                  />
                ))}
              </Card>
            ) : (
              <EmptyState icon="time-outline" title="No money movements yet" />
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

// The wallet balance in one sentence: cash the user is holding, or what
// finance owes them.
function BalanceCard({ balance }: { balance: number }) {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const owed = balance < 0;
  const title = balance > 0 ? 'Cash with you' : owed ? 'Finance owes you' : 'Your wallet is clear';
  const hint =
    balance > 0
      ? 'Cash from your advances. Add a bill for what you buy, and give back what is left.'
      : owed
        ? 'You spent more than your advance. Finance pays you this when the advance is closed.'
        : 'No advance cash with you right now.';
  return (
    <View style={styles.balance} accessible accessibilityLabel={`${title}: ${formatMoney(Math.abs(balance))}`}>
      <View style={styles.balanceIcon}>
        <Ionicons name={owed ? 'trending-down' : 'wallet'} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.balanceTitle}>{title}</Text>
      <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(Math.abs(balance))}
      </Text>
      <Text style={styles.balanceHint}>{hint}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  list: {
    gap: spacing.three,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  history: {
    gap: 0,
    paddingVertical: spacing.two,
  },
  balance: {
    gap: spacing.one,
    padding: spacing.five,
    borderRadius: radius.large,
    backgroundColor: colors.primary,
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: spacing.two,
  },
  balanceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
}));
