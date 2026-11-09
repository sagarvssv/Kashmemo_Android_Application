import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow } from '@/components/card';
import { TextField } from '@/components/text-field';
import { spacing } from '@/constants/theme';
import { useCurrency } from '@/context/currency';
import { createStyles, useColors } from '@/context/theme';
import { CURRENCIES } from '@/lib/currencies';

export function CurrencyPicker() {
  const styles = useStyles();
  const colors = useColors();
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const search = query.trim().toLowerCase();
  const options = search
    ? CURRENCIES.filter((option) =>
        [option.code, option.name, option.country].some((text) => text.toLowerCase().includes(search)),
      )
    : CURRENCIES;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <ListRow
        icon="cash-outline"
        title="Currency"
        subtitle={`${currency.flag}  ${currency.code} · ${currency.name}`}
        onPress={() => setOpen(true)}
      />

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Currency</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <TextField
              icon="search-outline"
              placeholder="Search country or currency"
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FlatList
            data={options}
            keyExtractor={(option) => option.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={<Text style={styles.empty}>No currencies match “{query.trim()}”.</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  setCurrency(item.code);
                  close();
                }}>
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>
                    {item.code} · {item.name}
                  </Text>
                  <Text style={styles.optionCountry}>{item.country}</Text>
                </View>
                {item.code === currency.code && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.four,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  search: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.two,
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
    paddingVertical: spacing.three,
    gap: spacing.three,
  },
  optionPressed: {
    opacity: 0.6,
  },
  flag: {
    fontSize: 24,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  optionCountry: {
    fontSize: 12,
    color: colors.textMuted,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.eight,
  },
}));
