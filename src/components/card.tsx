import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { PressableScale } from '@/components/motion';
import { iconBadge, radius, spacing, typography } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

type SectionProps = {
  title: string;
  action?: { label: string; onPress: () => void };
  // Adds a triangle before the title; tapping the title opens or closes the section.
  collapsible?: boolean;
  // Whether a collapsible section starts open.
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function Section({ title, action, collapsible, defaultOpen = true, children }: SectionProps) {
  const styles = useStyles();
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  const shown = !collapsible || open;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {collapsible ? (
          <PressableScale
            haptic="select"
            onPress={() => setOpen((current) => !current)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${title}. ${open ? 'Close' : 'Open'} section`}
            style={styles.sectionToggle}>
            <Ionicons name={open ? 'caret-down' : 'caret-forward'} size={14} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </PressableScale>
        ) : (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        {action && (
          <PressableScale onPress={action.onPress} hitSlop={8}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </PressableScale>
        )}
      </View>
      {shown ? children : null}
    </View>
  );
}

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  // Accent for the icon badge; defaults to the primary color.
  tint?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
};

export function ListRow({ title, subtitle, meta, icon, tint, right, onPress, destructive }: ListRowProps) {
  const styles = useStyles();
  const colors = useColors();
  const accent = destructive ? colors.danger : (tint ?? colors.primary);
  const content = (
    <>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: iconBadge(accent) }]}>
          <Ionicons name={icon} size={16} color={accent} />
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
      {onPress && !right ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
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

export function KeyValue({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  tint?: string;
}) {
  const styles = useStyles();
  const colors = useColors();
  const accent = tint ?? colors.primary;
  return (
    <View style={styles.keyValue}>
      <View style={styles.keyLabel}>
        {icon && (
          <View style={[styles.keyIcon, { backgroundColor: iconBadge(accent) }]}>
            <Ionicons name={icon} size={13} color={accent} />
          </View>
        )}
        <Text style={styles.key}>{label}</Text>
      </View>
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
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  sectionTitle: {
    ...typography.headline,
    color: colors.textPrimary,
  },
  sectionAction: {
    ...typography.footnoteStrong,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  rowSubtitle: {
    ...typography.footnote,
    color: colors.textMuted,
  },
  rowMeta: {
    ...typography.calloutStrong,
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
  keyLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    flexShrink: 0,
  },
  keyIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  key: {
    ...typography.callout,
    color: colors.textMuted,
  },
  value: {
    flexShrink: 1,
    ...typography.calloutStrong,
    color: colors.textPrimary,
    textAlign: 'right',
  },
}));
