import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { EXPENSE_CATEGORIES } from '@/constants/expense-categories';
import { radius, spacing } from '@/constants/theme';
import { useCurrency } from '@/context/currency';
import { createStyles, useColors } from '@/context/theme';
import type { InvoiceCategory } from '@/lib/invoices';

// Building blocks for the simple step-by-step forms (Request an advance, Upload a
// bill): numbered steps, a big amount box and picture buttons for the type.

export function Step({
  number,
  title,
  done,
  optional,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepBadge, done && styles.stepBadgeDone]}>
          {done ? (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          ) : (
            <Text style={styles.stepNumber}>{number}</Text>
          )}
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
        {optional && !done ? <Text style={styles.optional}>optional</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function parseAmount(text: string) {
  const value = Number(text.replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function AmountInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const styles = useStyles();
  const colors = useColors();
  const { currency } = useCurrency();
  return (
    <View style={[styles.amountBox, parseAmount(value) !== null && styles.amountBoxDone]}>
      <Text style={styles.currency}>{currency.code}</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChange}
        accessibilityLabel={`Amount in ${currency.name}`}
        maxLength={12}
      />
    </View>
  );
}

export function CategoryPicker({
  value,
  onChange,
}: {
  value: InvoiceCategory | null;
  onChange: (value: InvoiceCategory | null) => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.categories}>
      {EXPENSE_CATEGORIES.map((item) => {
        const selected = value === item.value;
        return (
          <PressableScale
            key={item.value}
            haptic="select"
            onPress={() => onChange(selected ? null : item.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            style={[styles.category, selected && styles.categorySelected]}>
            <Ionicons name={item.icon} size={28} color={selected ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.categoryText, selected && styles.categoryTextSelected]} numberOfLines={1}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function NoteInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.noteBox}>
      <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      <TextInput
        style={styles.noteInput}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        maxLength={300}
        multiline
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  step: {
    gap: spacing.three,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  stepBadgeDone: {
    backgroundColor: colors.success,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  optional: {
    fontSize: 13,
    color: colors.textMuted,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    minHeight: 72,
    paddingHorizontal: spacing.four,
    borderRadius: radius.large,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  amountBoxDone: {
    borderColor: colors.success,
  },
  currency: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: spacing.two,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.three,
  },
  category: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 84,
    padding: spacing.two,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  categorySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.two,
    minHeight: 56,
    padding: spacing.three,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingTop: 0,
  },
}));
