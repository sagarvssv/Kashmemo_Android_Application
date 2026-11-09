import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ChipGroup, Segmented } from '@/components/chip-group';
import { Appear, PressableScale } from '@/components/motion';
import { Pager } from '@/components/pager';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Tag } from '@/components/status-badge';
import { TextField } from '@/components/text-field';
import { radius, spacing } from '@/constants/theme';
import { useCurrentUser, useRealtime } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { departmentApi, employeeApi, managerApi } from '@/lib/endpoints';
import { initials, ROLE_LABELS } from '@/lib/format';
import { can } from '@/lib/permissions';
import type { Employee } from '@/lib/types';

export default function PeopleScreen() {
  const styles = useStyles();
  const colors = useColors();
  const user = useCurrentUser();
  const isManager = user.role === 'MANAGER';

  return (
    <Screen
      title="People"
      scroll={false}
      right={
        <View style={styles.headerActions}>
          {can.uploadCsv(user.role) && (
            <PressableScale onPress={() => router.push('/upload-csv')} hitSlop={8} accessibilityLabel="Upload CSV">
              <Ionicons name="cloud-upload-outline" size={26} color={colors.primary} />
            </PressableScale>
          )}
          {can.addEmployee(user.role) && (
            <PressableScale onPress={() => router.push('/add-employee')} hitSlop={8} accessibilityLabel="Add employee">
              <Ionicons name="person-add" size={24} color={colors.primary} />
            </PressableScale>
          )}
        </View>
      }>
      {isManager ? <DepartmentPeople managerId={user.userId} /> : <OrganizationPeople />}
    </Screen>
  );
}

type StatusFilter = 'all' | 'active' | 'inactive';

// A manager's team, one department at a time, with search and an
// active / not-active-yet filter. The list is small and comes back whole,
// so filtering happens on the phone.
function DepartmentPeople({ managerId }: { managerId: string }) {
  const styles = useStyles();
  const departments = useApi(() => managerApi.departments(managerId), [managerId]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const list = departments.data?.data ?? [];
  const selectedId = departmentId ?? list.find((department) => department.isPrimary)?.id ?? list[0]?.id;

  const employees = useApi(
    () => (selectedId ? employeeApi.inDepartment(selectedId).then((r) => r.data) : Promise.resolve([])),
    [selectedId],
  );

  useRealtime(['employee:created', 'employee:update'], () => {
    void employees.reload();
  });

  if (departments.isLoading && !departments.data) return <LoadingState />;
  if (departments.error && !departments.data) {
    return <ErrorState message={departments.error} onRetry={departments.reload} />;
  }

  const everyone = employees.data ?? [];
  const activeCount = everyone.filter((employee) => employee.status === 'ACTIVE').length;
  const query = search.trim().toLowerCase();
  const shown = everyone.filter((employee) => {
    if (status === 'active' && employee.status !== 'ACTIVE') return false;
    if (status === 'inactive' && employee.status === 'ACTIVE') return false;
    if (!query) return true;
    return [employee.name, employee.email, employee.designation]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  return (
    <>
      <View style={styles.filters}>
        <TextField
          icon="search-outline"
          placeholder="Search name, email or job title"
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          trailingIcon={search ? 'close-circle' : undefined}
          onTrailingIconPress={() => setSearch('')}
        />
        {list.length > 1 && (
          <ChipGroup
            options={list.map((department) => ({
              value: department.id,
              label: department.isPrimary ? `${department.name} (primary)` : department.name,
            }))}
            value={selectedId ?? ''}
            onChange={setDepartmentId}
          />
        )}
        <Segmented
          options={[
            { value: 'all', label: `All (${everyone.length})` },
            { value: 'active', label: `Active (${activeCount})` },
            { value: 'inactive', label: `Not active (${everyone.length - activeCount})` },
          ]}
          value={status}
          onChange={setStatus}
        />
        {employees.data && (query || status !== 'all') ? (
          <Text style={styles.count}>
            {shown.length === 0
              ? 'No one matches'
              : `Showing ${shown.length} of ${everyone.length} ${everyone.length === 1 ? 'person' : 'people'}`}
          </Text>
        ) : null}
      </View>
      <PeopleList
        employees={shown}
        isLoading={employees.isLoading}
        error={employees.error}
        onRetry={employees.reload}
        refreshing={employees.isRefreshing}
        onRefresh={employees.refresh}
      />
    </>
  );
}

const PAGE_SIZE = 20;
const ALL_DEPARTMENTS = 'ALL';
// Only the first screenful cascades in, so rows further down never lag while scrolling.
const CASCADE_ROWS = 10;

// Everyone in the organisation, searchable and filterable by department, one
// page at a time.
function OrganizationPeople() {
  const styles = useStyles();
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<string>(ALL_DEPARTMENTS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const listRef = useRef<FlatList<Employee>>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      // A new search starts from the first page.
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // useApi reloads this whenever the tab regains focus, so newly added
  // departments show up as new chips.
  const departments = useApi(() => departmentApi.list().then((r) => r.data), []);
  const departmentOptions = [
    { value: ALL_DEPARTMENTS, label: 'All departments' },
    ...(departments.data ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];
  // Falls back to all departments if the chosen one has since been removed.
  const selectedDepartment = departmentOptions.some((option) => option.value === department)
    ? department
    : ALL_DEPARTMENTS;

  const people = useApi(
    () =>
      employeeApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        departmentId: selectedDepartment === ALL_DEPARTMENTS ? undefined : selectedDepartment,
      }),
    [page, debouncedSearch, selectedDepartment],
  );

  const changeDepartment = (next: string) => {
    setDepartment(next);
    // A new filter starts from the first page.
    setPage(1);
  };

  const refresh = async () => {
    await Promise.all([people.refresh(), departments.refresh()]);
  };

  useRealtime(['employee:created', 'employee:update'], () => {
    void people.reload();
  });

  const pagination = people.data?.pagination;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);
  const total = pagination?.total ?? 0;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  const goTo = (next: number) => {
    setPage(Math.min(Math.max(next, 1), totalPages));
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  return (
    <>
      <View style={styles.filters}>
        <TextField
          icon="search-outline"
          placeholder="Search by name or email"
          autoCapitalize="none"
          autoCorrect={false}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          trailingIcon={search ? 'close-circle' : undefined}
          onTrailingIconPress={() => setSearch('')}
        />
        {departmentOptions.length > 1 && (
          <ChipGroup options={departmentOptions} value={selectedDepartment} onChange={changeDepartment} />
        )}
        {pagination && (
          <Text style={styles.count}>
            {total === 0 ? 'No people' : `Showing ${first}–${last} of ${total} ${total === 1 ? 'person' : 'people'}`}
          </Text>
        )}
      </View>
      <PeopleList
        listRef={listRef}
        employees={people.isLoading ? [] : (people.data?.data ?? [])}
        isLoading={people.isLoading}
        error={people.error}
        onRetry={people.reload}
        refreshing={people.isRefreshing || departments.isRefreshing}
        onRefresh={refresh}
        footer={
          totalPages > 1 && !people.isLoading ? (
            <Pager
              page={page}
              totalPages={totalPages}
              hasNext={page < totalPages}
              onPrevious={() => goTo(page - 1)}
              onNext={() => goTo(page + 1)}
            />
          ) : null
        }
      />
    </>
  );
}

type PeopleListProps = {
  listRef?: React.RefObject<FlatList<Employee> | null>;
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  footer?: React.ReactElement | null;
};

function PeopleList({
  listRef,
  employees,
  isLoading,
  error,
  onRetry,
  refreshing,
  onRefresh,
  footer,
}: PeopleListProps) {
  const styles = useStyles();
  if (isLoading && employees.length === 0) return <LoadingState />;
  if (error && employees.length === 0) return <ErrorState message={error} onRetry={onRetry} />;

  return (
    <FlatList
      ref={listRef}
      data={employees}
      keyExtractor={(employee) => employee.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<EmptyState icon="people-outline" title="No people found" />}
      ListFooterComponent={footer ?? undefined}
      renderItem={({ item, index }) =>
        index < CASCADE_ROWS ? (
          <Appear index={index}>
            <PersonRow employee={item} />
          </Appear>
        ) : (
          <PersonRow employee={item} />
        )
      }
    />
  );
}

function PersonRow({ employee }: { employee: Employee }) {
  const styles = useStyles();
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/employee/[id]', params: { id: employee.id } })}
      style={({ pressed }) => [styles.person, pressed && { opacity: 0.7 }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(employee.name)}</Text>
      </View>
      <View style={styles.personText}>
        <Text style={styles.personName} numberOfLines={1}>
          {employee.name}
        </Text>
        <Text style={styles.personMeta} numberOfLines={1}>
          {[employee.designation, employee.department?.name].filter(Boolean).join(' · ') || employee.email}
        </Text>
        {/* Invited but hasn't signed in and set a password yet, or switched off. */}
        {employee.status && employee.status !== 'ACTIVE' ? (
          <Text style={styles.inactive}>{employee.status === 'DISABLED' ? 'Disabled' : 'Not active yet'}</Text>
        ) : null}
      </View>
      <Tag label={ROLE_LABELS[employee.role]} />
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.four,
  },
  filters: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.three,
    gap: spacing.three,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
  },
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
  },
  separator: {
    height: spacing.two,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    padding: spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  personText: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inactive: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  personMeta: {
    fontSize: 13,
    color: colors.textMuted,
  },
}));
