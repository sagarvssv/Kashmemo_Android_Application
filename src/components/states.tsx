import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

// Skeleton placeholders shaped like the cards and rows that are loading,
// gently pulsing, instead of a bare spinner.
export function LoadingState({ rows = 3 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <Skeleton style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <Skeleton style={[styles.skeletonLine, { width: index % 2 ? '55%' : '70%' }]} />
            <Skeleton style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && <PrimaryButton label="Try again" onPress={onRetry} variant="secondary" compact />}
    </View>
  );
}

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon = 'file-tray-outline', title, message, action }: EmptyStateProps) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={32} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function InlineError({ message }: { message: string | null }) {
  const styles = useStyles();
  const colors = useColors();
  if (!message) return null;
  return (
    <View style={styles.inline}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <Text style={styles.inlineText}>{message}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  skeletons: {
    gap: spacing.three,
    paddingVertical: spacing.two,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.three,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  skeletonLines: {
    flex: 1,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.borderLight,
  },
  skeletonLineShort: {
    width: '35%',
    height: 10,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.eight,
    paddingHorizontal: spacing.six,
    gap: spacing.three,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  inline: {
    flexDirection: 'row',
    gap: spacing.two,
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: spacing.three,
  },
  inlineText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
  },
}));
