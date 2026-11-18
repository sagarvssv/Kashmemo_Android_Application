import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear } from '@/components/motion';
import { iconBadge, spacing, TAB_BAR_CLEARANCE, typography } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { goBackOrReplace } from '@/utils/navigation';

type HeaderProps = {
  title: string;
  subtitle?: string;
  // Shows a back chevron that returns to the previous screen, or this route when there is none.
  backFallback?: string;
  right?: React.ReactNode;
  // Shown before the title, e.g. the user's avatar on a dashboard.
  leading?: React.ReactNode;
  // Rendered under the title in place of `subtitle`, e.g. a role pill.
  meta?: React.ReactNode;
  // Small line above the title, e.g. "Good morning" on Home.
  overline?: string;
};

// Same layout as the iOS app: a large title on tab screens, a smaller one on
// detail screens (with a back arrow).
export function ScreenHeader({ title, subtitle, backFallback, right, leading, meta, overline }: HeaderProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.header}>
      {backFallback && (
        <Pressable onPress={() => goBackOrReplace(backFallback)} hitSlop={8} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
      )}
      {leading}
      <View style={styles.headerText}>
        {overline ? (
          <Text style={styles.overline} numberOfLines={1}>
            {overline}
          </Text>
        ) : null}
        <Text
          style={[styles.title, backFallback || overline ? styles.titleCompact : null]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
        {meta ??
          (subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null)}
      </View>
      {right}
    </View>
  );
}

// Round, tinted action button for the right side of a screen header.
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  // Small count in the corner, e.g. unread notifications.
  badge?: number;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.headerButton,
        { backgroundColor: iconBadge(colors.primary) },
        pressed && { opacity: 0.7 },
      ]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      {badge ? (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
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
  const colors = useColors();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader {...header} />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, footer ? styles.contentWithFooter : null]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} colors={[colors.primary]} />
              ) : undefined
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
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  headerBadgeText: {
    ...typography.micro,
    color: '#FFFFFF',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  overline: {
    ...typography.footnote,
    color: colors.textMuted,
    marginBottom: 1,
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  // Detail screens (with a back arrow) use the smaller title.
  titleCompact: {
    ...typography.title,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.textMuted,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.four,
    // Room for the floating tab bar.
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: spacing.four,
  },
  // A footer button sits above the content, so no tab-bar gap is needed.
  contentWithFooter: {
    paddingBottom: spacing.eight,
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
