import { router } from 'expo-router';
import React from 'react';

import { Section } from '@/components/card';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { useFormatMoney } from '@/context/currency';
import { useRealtime } from '@/context/session';
import { useApi } from '@/hooks/use-api';
import { ticketApi } from '@/lib/endpoints';
import { toAmount } from '@/lib/format';

const COUNT_LIMIT = 50;

// The signed-in user's own advances and claims, for roles whose Home is about
// other people's tickets (e.g. a Manager): money waiting for approval, approved
// money to collect, and advance cash with them. Hidden until there is any, so
// Home stays short for people who never raise anything.
export function useMyMoney() {
  const wallet = useApi(() => ticketApi.wallet().then((r) => r.data), []);
  const waiting = useApi(
    () =>
      Promise.all([
        ticketApi.mine({ status: 'PENDING', limit: COUNT_LIMIT }),
        ticketApi.mine({ status: 'PARTIALLY_APPROVED', limit: COUNT_LIMIT }),
      ]).then(([pending, partial]) => [...pending.data, ...partial.data]),
    [],
  );

  useRealtime(['ticket:created', 'ticket:status-update'], () => {
    void wallet.reload();
    void waiting.reload();
  });

  const refresh = async () => {
    await Promise.all([wallet.refresh(), waiting.refresh()]);
  };

  return { wallet: wallet.data, waiting: waiting.data, refresh };
}

export function MyMoneySection({ money }: { money: ReturnType<typeof useMyMoney> }) {
  const formatMoney = useFormatMoney();
  const { wallet, waiting } = money;
  if (!wallet || !waiting) return null;

  const waitingTotal = waiting.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  const collectTotal = wallet.awaitingCollection.reduce((sum, ticket) => sum + toAmount(ticket.amount), 0);
  // + advance cash with them, - what finance owes them.
  const balance = wallet.balance;
  const hasOpenAdvance = wallet.openAdvances.length > 0;
  if (waiting.length === 0 && collectTotal === 0 && balance === 0 && !hasOpenAdvance) return null;

  return (
    <Section title="Your own money" action={{ label: 'My claims', onPress: () => router.push('/bills') }}>
      <StatGrid>
        <StatTile
          label="Waiting for approval"
          value={formatMoney(waitingTotal)}
          icon="hourglass-outline"
          onPress={() => router.push({ pathname: '/tickets', params: { scope: 'mine', status: 'PENDING' } })}
          accessibilityHint="Opens your own tickets waiting for approval"
        />
        <StatTile
          label="Approved · collect from finance"
          value={formatMoney(collectTotal)}
          icon="time-outline"
          tone="highlight"
          onPress={() => router.push({ pathname: '/wallet', params: { tab: 'collect' } })}
          accessibilityHint="Opens the approved money you can collect from finance"
        />
        <StatTile
          label={balance < 0 ? 'Finance owes you' : 'Cash with you'}
          value={formatMoney(Math.abs(balance))}
          icon="wallet-outline"
          onPress={() => router.push({ pathname: '/wallet', params: { tab: 'advances' } })}
          accessibilityHint="Opens your open advances"
        />
      </StatGrid>
    </Section>
  );
}
