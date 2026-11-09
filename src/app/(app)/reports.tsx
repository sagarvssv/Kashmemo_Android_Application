import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View} from 'react-native';

import { ChipGroup, Segmented } from '@/components/chip-group';
import { Card, Divider, KeyValue, ListRow, Section } from '@/components/card';
import { DateRangePicker, type DateRange } from '@/components/date-range-picker';
import { currentMonth, MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { TicketRow } from '@/components/ticket-row';
import { spacing } from '@/constants/theme';
import { useFormatMoney } from '@/context/currency';
import { useCurrentUser } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { dashboardApi } from '@/lib/endpoints';
import { formatDate, STATUS_LABELS, toIsoDate } from '@/lib/format';
import { can } from '@/lib/permissions';
import { TICKET_STATUSES } from '@/lib/types';

type Report = 'payouts' | 'daily';

export default function ReportsScreen() {
  const user = useCurrentUser();
  const reports: { value: Report; label: string }[] = [];
  if (can.viewDisbursedReport(user.role)) reports.push({ value: 'payouts', label: 'Payouts' });
  if (can.viewDailyReport(user.role)) reports.push({ value: 'daily', label: 'Daily tickets' });
  const [report, setReport] = useState<Report>(reports[0]?.value ?? 'daily');

  return (
    <Screen title="Reports" backFallback="/profile">
      {reports.length > 1 && <Segmented options={reports} value={report} onChange={setReport} />}
      {report === 'payouts' ? <PayoutsReport /> : <DailyReport />}
    </Screen>
  );
}

function PayoutsReport() {
  const styles = useStyles();
  const formatMoney = useFormatMoney();
  const [month, setMonth] = useState(currentMonth);
  const summary = useApi(() => dashboardApi.disbursedSummary(month).then((r) => r.data), [month]);
  const tickets = useApi(() => dashboardApi.disbursedTickets(month).then((r) => r.data), [month]);

  const departments = Object.entries(summary.data?.departmentSummary ?? {});
  const ticketCount = departments.reduce((sum, [, department]) => sum + department.ticketCount, 0);

  return (
    <>
      <MonthSwitcher value={month} onChange={setMonth} />
      {summary.isLoading && !summary.data ? <LoadingState /> : null}
      {summary.error && !summary.data ? <ErrorState message={summary.error} onRetry={summary.reload} /> : null}

      {summary.data && (
        <>
          <StatGrid>
            <StatTile
              label="Paid out"
              value={formatMoney(summary.data.totalDisbursedAmount)}
              icon="cash-outline"
              tone="highlight"
            />
            <StatTile label="Tickets paid" value={String(ticketCount)} icon="receipt-outline" />
          </StatGrid>

          <Section title="By department">
            <Card style={styles.rows}>
              {departments.length === 0 ? (
                <EmptyState icon="cash-outline" title="No payouts this month" />
              ) : (
                departments.map(([departmentId, department]) => (
                  <ListRow
                    key={departmentId}
                    icon="business-outline"
                    title={department.departmentName}
                    subtitle={`${department.ticketCount} ticket${department.ticketCount === 1 ? '' : 's'}`}
                    meta={formatMoney(department.totalAmount)}
                  />
                ))
              )}
            </Card>
          </Section>
        </>
      )}

      {tickets.data && tickets.data.length > 0 && (
        <Section title="Paid tickets">
          <View style={styles.list}>
            {tickets.data.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </View>
        </Section>
      )}
    </>
  );
}

type Range = 'today' | 'week' | 'month' | 'thirty' | 'custom';

// Matches MAX_REPORT_DAYS in the backend's daily-ticket-report handler.
const MAX_REPORT_DAYS = 92;

function rangeDates(range: Exclude<Range, 'custom'>): DateRange {
  const today = new Date();
  const start = new Date(today);
  if (range === 'week') start.setDate(today.getDate() - 6);
  if (range === 'thirty') start.setDate(today.getDate() - 29);
  if (range === 'month') start.setDate(1);
  return { start: toIsoDate(start), end: toIsoDate(today) };
}

function DailyReport() {
  const styles = useStyles();
  const colors = useColors();
  const formatMoney = useFormatMoney();
  const [range, setRange] = useState<Range>('week');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { start, end } = range === 'custom' && customRange ? customRange : rangeDates(range === 'custom' ? 'week' : range);
  const report = useApi(() => dashboardApi.dailyReport(start, end).then((r) => r.data), [start, end]);

  const days = [...(report.data?.summary ?? [])].reverse();
  const totalCount = days.reduce((sum, day) => sum + day.totalCount, 0);
  const totalAmount = days.reduce((sum, day) => sum + day.totalAmount, 0);

  return (
    <>
      <ChipGroup
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 days' },
          { value: 'month', label: 'This month' },
          { value: 'thirty', label: 'Last 30 days' },
          { value: 'custom', label: 'Custom' },
        ]}
        value={range}
        // Custom only takes effect once a range is applied in the calendar.
        onChange={(next) => (next === 'custom' ? setPickerOpen(true) : setRange(next))}
      />

      {range === 'custom' && customRange && (
        <Pressable onPress={() => setPickerOpen(true)} style={styles.customRange} accessibilityRole="button">
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.customRangeText}>
            {customRange.start === customRange.end
              ? formatDate(customRange.start)
              : `${formatDate(customRange.start)} – ${formatDate(customRange.end)}`}
          </Text>
          <Text style={styles.customRangeChange}>Change</Text>
        </Pressable>
      )}

      <DateRangePicker
        visible={pickerOpen}
        initialRange={customRange ?? { start, end }}
        maxDays={MAX_REPORT_DAYS}
        onClose={() => setPickerOpen(false)}
        onApply={(next) => {
          setCustomRange(next);
          setRange('custom');
          setPickerOpen(false);
        }}
      />

      {report.isLoading && !report.data ? <LoadingState /> : null}
      {report.error && !report.data ? <ErrorState message={report.error} onRetry={report.reload} /> : null}

      {report.data && (
        <>
          <StatGrid>
            <StatTile label="Tickets raised" value={String(totalCount)} icon="receipt-outline" tone="highlight" />
            <StatTile label="Total requested" value={formatMoney(totalAmount)} icon="cash-outline" />
          </StatGrid>

          {days.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No tickets in this period" />
          ) : (
            days.map((day) => (
              <Card key={day.day}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{formatDate(day.day)}</Text>
                  <Text style={styles.dayTotal}>
                    {day.totalCount} · {formatMoney(day.totalAmount)}
                  </Text>
                </View>
                <Divider />
                {TICKET_STATUSES.filter((status) => day.count[status] > 0).map((status) => (
                  <KeyValue
                    key={status}
                    label={`${STATUS_LABELS[status]} (${day.count[status]})`}
                    value={formatMoney(day.amount[status])}
                  />
                ))}
              </Card>
            ))
          )}
        </>
      )}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  list: {
    gap: spacing.three,
  },
  rows: {
    gap: 0,
    paddingVertical: spacing.one,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  customRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
  },
  customRangeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  customRangeChange: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  dayTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
}));
