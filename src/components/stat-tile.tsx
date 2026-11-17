import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedFill, PressableScale } from '@/components/motion';
import { iconBadge, radius, spacing, typography } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

type StatTileProps = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'highlight';
  // Accent for the icon badge on default tiles; defaults to the primary color.
  tint?: string;
  // Makes the tile a button (with a small arrow) that opens the details.
  onPress?: () => void;
  accessibilityHint?: string;
};

// Same layout as the iOS app: icon badge and a small uppercase label on top,
// the value below.
export function StatTile({ label, value, icon, tone = 'default', tint, onPress, accessibilityHint }: StatTileProps) {
  const styles = useStyles();
  const colors = useColors();
  const highlight = tone === 'highlight';
  const accent = tint ?? colors.primary;
  const content = (
    <>
      <View style={styles.tileHeader}>
        {icon ? (
          <View style={[styles.iconBadge, { backgroundColor: highlight ? '#FFFFFF' : iconBadge(accent) }]}>
            <Ionicons name={icon} size={13} color={highlight ? colors.primary : accent} />
          </View>
        ) : null}
        <Text style={[styles.label, highlight && styles.highlightLabel]} numberOfLines={2}>
          {label}
        </Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={14} color={highlight ? 'rgba(255,255,255,0.8)' : colors.textMuted} />
        ) : null}
      </View>
      {/* No adjustsFontSizeToFit: on Android it can draw nothing at all. */}
      <Text style={[styles.value, value.length > 12 && styles.valueLong, highlight && styles.highlightText]} numberOfLines={1}>
        {value}
      </Text>
    </>
  );

  if (!onPress) return <View style={[styles.tile, highlight && styles.highlight]}>{content}</View>;
  return (
    <PressableScale
      haptic="tap"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      style={[styles.tile, highlight && styles.highlight]}>
      {content}
    </PressableScale>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.grid}>{children}</View>;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const styles = useStyles();
  const colors = useColors();
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <View style={styles.track}>
      <AnimatedFill
        percent={ratio * 100}
        style={[styles.fill, (over || ratio > 0.9) && { backgroundColor: colors.danger }]}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 26,
  },
  iconBadge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.three,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    // Lets the tile shrink to its half of the row instead of growing with its text.
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    padding: spacing.three,
    gap: spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  highlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  value: {
    ...typography.headline,
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  valueLong: {
    fontSize: 14,
  },
  highlightText: {
    color: '#FFFFFF',
  },
  // Long labels wrap to a second line inside the tile instead of overflowing it.
  label: {
    ...typography.overline,
    flex: 1,
    flexShrink: 1,
    color: colors.textMuted,
  },
  highlightLabel: {
    color: 'rgba(255,255,255,0.8)',
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
}));
