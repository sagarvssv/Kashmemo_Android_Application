import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { formatDate, toIsoDate } from '@/lib/format';

export type DateRange = { start: string; end: string };

type DateRangePickerProps = {
  visible: boolean;
  initialRange?: DateRange | null;
  // Longest range allowed, counting both ends (the daily report allows 92 days).
  maxDays?: number;
  onApply: (range: DateRange) => void;
  onClose: () => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ISO dates (YYYY-MM-DD) compare correctly as strings.
function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number): string {
  const date = parseIso(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// Calendar cells for a month, padded with nulls so the 1st lands on its weekday.
function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(first.getDay()).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(toIsoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateRangePicker({ visible, initialRange, maxDays = 92, onApply, onClose }: DateRangePickerProps) {
  const styles = useStyles();
  const colors = useColors();
  const today = toIsoDate(new Date());
  const [start, setStart] = useState<string | null>(initialRange?.start ?? null);
  const [end, setEnd] = useState<string | null>(initialRange?.end ?? null);
  const [shown, setShown] = useState(() => {
    const anchor = parseIso(initialRange?.end ?? today);
    return { year: anchor.getFullYear(), month: anchor.getMonth() };
  });

  // Reset to the applied range each time the picker opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setStart(initialRange?.start ?? null);
      setEnd(initialRange?.end ?? null);
      const anchor = parseIso(initialRange?.end ?? today);
      setShown({ year: anchor.getFullYear(), month: anchor.getMonth() });
    }
  }

  // While only a start is picked, the end can't be more than maxDays - 1 days later.
  const latestEnd = start && !end ? addDays(start, maxDays - 1) : null;

  const isDisabled = (day: string) => {
    if (day > today) return true;
    if (latestEnd && day > latestEnd) return true;
    return false;
  };

  const pick = (day: string) => {
    if (!start || end || day < start) {
      // Start a new range.
      setStart(day);
      setEnd(null);
    } else {
      setEnd(day);
    }
  };

  const shiftMonth = (delta: number) => {
    setShown(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const isCurrentMonth = shown.year === new Date().getFullYear() && shown.month === new Date().getMonth();
  const cells = monthCells(shown.year, shown.month);
  const rangeEnd = end ?? start;

  const summary = !start
    ? 'Select a start date'
    : !end
      ? `${formatDate(start)} – select an end date`
      : start === end
        ? formatDate(start)
        : `${formatDate(start)} – ${formatDate(end)}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow taps so pressing inside the sheet doesn't close it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Custom range</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.summary}>{summary}</Text>

          <View style={styles.monthRow}>
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS[shown.month]} {shown.year}
            </Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={8}
              accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? colors.borderLight : colors.primary} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {WEEKDAYS.map((label, index) => (
              <Text key={index} style={[styles.cell, styles.weekday]}>
                {label}
              </Text>
            ))}
            {cells.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
              const disabled = isDisabled(day);
              const isEdge = day === start || day === end;
              const inRange = !!start && !!rangeEnd && day > start && day < rangeEnd;
              return (
                <Pressable
                  key={day}
                  onPress={() => pick(day)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={formatDate(day)}
                  accessibilityState={{ selected: isEdge, disabled }}
                  style={[styles.cell, inRange && styles.inRange]}>
                  <View style={[styles.dayCircle, isEdge && styles.edge, day === today && !isEdge && styles.today]}>
                    <Text
                      style={[styles.dayText, isEdge && styles.edgeText, disabled && styles.disabledText]}>
                      {parseIso(day).getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint}>Up to {maxDays} days. Tap a start date, then an end date.</Text>

          <View style={styles.actions}>
            <PrimaryButton label="Cancel" variant="secondary" compact onPress={onClose} style={styles.action} />
            <PrimaryButton
              label="Apply"
              compact
              disabled={!start}
              // A single tapped day is a one-day range.
              onPress={() => start && onApply({ start, end: end ?? start })}
              style={styles.action}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL = `${100 / 7}%` as const;

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.four,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.four,
    gap: spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlignVertical: 'center',
  },
  inRange: {
    backgroundColor: colors.background,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: {
    backgroundColor: colors.primary,
  },
  today: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  edgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabledText: {
    color: colors.borderLight,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  action: {
    flex: 1,
  },
}));
