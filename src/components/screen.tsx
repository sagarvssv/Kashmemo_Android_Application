import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear } from '@/components/motion';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { goBackOrReplace } from '@/utils/navigation';

type HeaderProps = {
  title: string;
  subtitle?: string;
  // Shows a back chevron that returns to the previous screen, or this route when there is none.
  backFallback?: string;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, backFallback, right }: HeaderProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.header}>
      {backFallback && (
        <Pressable onPress={() => goBackOrReplace(backFallback)} hitSlop={8} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
      )}
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

type ScreenProps = HeaderProps & {
  children: React.ReactNode;
  // Set for screens that render their own FlatList instead of a ScrollView.
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
};

export function Screen({ children, scroll = true, refreshing, onRefresh, footer, ...header }: ScreenProps) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader {...header} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined
            }>
            {/* Each section fades up in turn as the screen opens or its data arrives. */}
            {React.Children.toArray(children).map((child, index) => (
              <Appear
                key={React.isValidElement(child) && child.key != null ? child.key : index}
                index={index}
                style={styles.section}>
                {child}
              </Appear>
            ))}
          </ScrollView>
        ) : (
          <Appear style={styles.flex}>{children}</Appear>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingHorizontal: spacing.four,
    paddingTop: spacing.three,
    paddingBottom: spacing.three,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
    gap: spacing.four,
  },
  // Same spacing inside each animated section, so a group of elements (e.g.
  // everything a dashboard renders once its data loads) stays spaced out.
  section: {
    gap: spacing.four,
  },
  footer: {
    paddingHorizontal: spacing.four,
    paddingTop: spacing.three,
    paddingBottom: spacing.six,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
}));
