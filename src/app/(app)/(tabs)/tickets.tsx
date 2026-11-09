import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ChipGroup, Segmented } from '@/components/chip-group';
import { Appear } from '@/components/motion';
import { Screen } from '@/components/screen';
import { Pager } from '@/components/pager';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { TicketRow } from '@/components/ticket-row';
import { spacing } from '@/constants/theme';
import { useCurrentUser, useRealtime } from '@/context/session';
import { useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { departmentApi, managerApi, ticketApi } from '@/lib/endpoints';
import { STATUS_LABELS } from '@/lib/format';
import { invoiceApiEnabled } from '@/lib/invoices';
import { can } from '@/lib/permissions';
import { TICKET_STATUSES, type Ticket, type TicketStatus, type UserRole } from '@/lib/types';

type Scope = 'mine' | 'team' | 'all';
type StatusFilter = TicketStatus | 'ALL';
const ALL_DEPARTMENTS = 'ALL';

const PAGE_SIZE = 10;
// Only the first screenful cascades in, so rows further down never lag while scrolling.
const CASCADE_ROWS = 10;

function scopesFor(role: UserRole): { value: Scope; label: string }[] {
  // The CEO approves and oversees rather than raising tickets, so only sees
  // the organisation-wide list.
  if (role === 'CEO') return [{ value: 'all', label: 'All tickets' }];
  const scopes: { value: Scope; label: string }[] = [{ value: 'mine', label: 'My tickets' }];
  if (can.viewDepartmentTickets(role)) scopes.push({ value: 'team', label: 'Department' });
  if (can.viewOrgTickets(role)) scopes.push({ value: 'all', label: 'All tickets' });
  return scopes;
}

function emptyMessage(status: StatusFilter, departmentLabel: string | undefined, noun: string): string | undefined {
  const what = status === 'ALL' ? noun : `${STATUS_LABELS[status].toLowerCase()} ${noun}`;
  if (departmentLabel && departmentLabel !== 'All departments') return `No ${what} in ${departmentLabel}.`;
  return status === 'ALL' ? undefined : `No ${what}.`;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...TICKET_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

export default function TicketsScreen() {
  const colors = useColors();
  const user = useCurrentUser();
  const params = useLocalSearchParams<{ scope?: Scope; status?: TicketStatus; departmentId?: string }>();
  const scopes = scopesFor(user.role);
  // Employees with a Claims tab see only their advances here (cash asked for
  // before spending); claims are on the Claims tab, so nothing shows twice.
  const advancesOnly = can.billsTab(user.role) && invoiceApiEnabled;
  const noun = advancesOnly ? 'advances' : 'tickets';
  // With several scopes, open on the second (Department / All tickets) rather
  // than the user's own; with one, that's the only choice.
  const defaultScope = scopes.length > 1 ? scopes[1].value : scopes[0].value;

  const [scope, setScope] = useState<Scope>(defaultScope);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  // Organisation-wide tickets can be narrowed to one department.
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);

  // useApi reloads this whenever the tab regains focus, so departments added
  // elsewhere (e.g. on the Departments screen) show up as new chips.
  // A Manager picks among the departments they manage (Department scope).
  const departments = useApi(
    () =>
      scopes.some((option) => option.value === 'all')
        ? departmentApi.list().then((r) => r.data)
        : scopes.some((option) => option.value === 'team')
          ? managerApi.departments(user.userId).then((r) => r.data)
          : Promise.resolve([]),
    [],
  );
  const departmentOptions = [
    { value: ALL_DEPARTMENTS, label: scope === 'team' ? 'All my departments' : 'All departments' },
    ...(departments.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  // Falls back to all departments if the chosen one has since been removed.
  const selectedDepartment = departmentOptions.some((option) => option.value === department)
    ? department
    : ALL_DEPARTMENTS;

  // Dashboard shortcuts deep-link into a scope and status; apply them whenever
  // they change (adjusting state during render rather than in an effect).
  // Home's counts are organisation-wide, so its shortcuts open on "All
  // departments" unless they name one.
  const paramsKey = `${params.scope ?? ''}|${params.status ?? ''}|${params.departmentId ?? ''}`;
  const [appliedParamsKey, setAppliedParamsKey] = useState('||');
  if (paramsKey !== appliedParamsKey) {
    setAppliedParamsKey(paramsKey);
    if (params.scope && scopes.some((option) => option.value === params.scope)) setScope(params.scope);
    if (params.status) setStatus(params.status);
    if (params.scope === 'all' || params.scope === 'team') setDepartment(params.departmentId ?? ALL_DEPARTMENTS);
  }

  // One page at a time. The ticket APIs are cursor-based, so we keep the cursor
  // each visited page started from; Previous steps back through them. Any
  // filter change starts again from page 1.
  const filterKey = `${scope}|${status}|${selectedDepartment}`;
  const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined]);
  const [pagedFilterKey, setPagedFilterKey] = useState(filterKey);
  if (filterKey !== pagedFilterKey) {
    setPagedFilterKey(filterKey);
    setPageCursors([undefined]);
  }
  const page = pageCursors.length;
  const cursor = pageCursors[page - 1];
  const listRef = useRef<FlatList<Ticket>>(null);

  const list = useApi(
    () => {
      const query = { cursor, limit: PAGE_SIZE, status: status === 'ALL' ? undefined : status };
      if (scope === 'team') {
        return ticketApi.department({
          ...query,
          departmentId: selectedDepartment === ALL_DEPARTMENTS ? undefined : selectedDepartment,
        });
      }
      if (scope === 'all') {
        return ticketApi.organization({
          ...query,
          departmentId: selectedDepartment === ALL_DEPARTMENTS ? undefined : selectedDepartment,
        });
      }
      return ticketApi.mine(advancesOnly ? { ...query, source: 'MANUAL' } : query);
    },
    [scope, status, selectedDepartment, cursor, advancesOnly],
  );
  // The filter is also applied here in case the backend ignores ?source.
  const tickets = (list.data?.data ?? []).filter((ticket) => !advancesOnly || ticket.source !== 'RECEIPT');
  const nextCursor = list.data?.nextCursor ?? null;

  const goNext = () => {
    if (!nextCursor) return;
    setPageCursors((current) => [...current, nextCursor]);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const goPrevious = () => {
    setPageCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  useRealtime(['ticket:created', 'ticket:status-update'], () => {
    void list.reload();
  });

  const refresh = async () => {
    await Promise.all([list.refresh(), departments.reload()]);
  };

  return (
    <Screen
      title={advancesOnly ? 'My advances' : 'Tickets'}
      subtitle={advancesOnly ? 'Cash you asked for before spending' : undefined}
      scroll={false}
      right={
        user.departmentId ? (
          <Pressable onPress={() => router.push('/raise-ticket')} hitSlop={8} accessibilityLabel="Request an advance">
            <Ionicons name="add-circle" size={30} color={colors.primary} />
          </Pressable>
        ) : undefined
      }>
      <View style={styles.filters}>
        {scopes.length > 1 && <Segmented options={scopes} value={scope} onChange={setScope} />}
        {(scope === 'all' || scope === 'team') && departmentOptions.length > 2 && (
          <ChipGroup options={departmentOptions} value={selectedDepartment} onChange={setDepartment} />
        )}
        <ChipGroup options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </View>

      {list.isLoading ? (
        <LoadingState />
      ) : list.error && tickets.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          ref={listRef}
          data={tickets}
          keyExtractor={(ticket) => ticket.id}
          renderItem={({ item, index }) =>
            index < CASCADE_ROWS ? (
              <Appear index={index}>
                <TicketRow ticket={item} />
              </Appear>
            ) : (
              <TicketRow ticket={item} />
            )
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <EmptyState
              icon={advancesOnly ? 'cash-outline' : 'receipt-outline'}
              title={`No ${noun} here`}
              message={
                emptyMessage(status, scope !== 'mine' ? departmentOptions.find((o) => o.value === selectedDepartment)?.label : undefined, noun) ??
                (advancesOnly ? 'Need cash before you spend? Tap + to request an advance. Spent your own money? That is a claim, on the Claims tab.' : undefined)
              }
            />
          }
          ListFooterComponent={
            page > 1 || nextCursor ? (
              <Pager page={page} hasNext={Boolean(nextCursor)} onPrevious={goPrevious} onNext={goNext} />
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: spacing.four,
    gap: spacing.three,
    paddingBottom: spacing.three,
  },
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
  },
  separator: {
    height: spacing.three,
  },
});
