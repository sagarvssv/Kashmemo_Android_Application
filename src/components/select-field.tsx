import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

type Option = { value: string; label: string; description?: string };

type SelectFieldProps = {
  label: string;
  placeholder?: string;
  value: string | null;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function SelectField({ label, placeholder = 'Select', value, options, onChange, disabled }: SelectFieldProps) {
  const styles = useStyles();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        style={[styles.field, disabled && styles.disabled]}
        accessibilityRole="button">
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(option) => option.value}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                style={styles.option}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {item.description ? <Text style={styles.optionDescription}>{item.description}</Text> : null}
                </View>
                {item.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  field: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  disabled: {
    opacity: 0.5,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.four,
    gap: spacing.three,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionDescription: {
    fontSize: 12,
    color: colors.textMuted,
  },
}));
