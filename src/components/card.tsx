import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { PressableScale } from '@/components/motion';
import { radius, spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

type SectionProps = {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
};

export function Section({ title, action, children }: SectionProps) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <PressableScale onPress={action.onPress} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </PressableScale>
        )}
      </View>
      {children}
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export function ListRow({ title, subtitle, meta, icon, right, onPress, destructive }: ListRowProps) {
  const styles = useStyles();
  const colors = useColors();
  const content = (
    <>
      {icon && (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={destructive ? colors.danger : colors.primary} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, destructive && { color: colors.danger }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {content}
    </PressableScale>
  );
}

export function Divider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

export function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.keyValue}>
      <Text style={styles.key}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={styles.value}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    padding: spacing.four,
    gap: spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  section: {
    gap: spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: spacing.three,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  rowMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  keyValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.three,
  },
  key: {
    fontSize: 14,
    color: colors.textMuted,
  },
  value: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
}));
