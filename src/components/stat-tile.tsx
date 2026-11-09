import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedFill, PressableScale } from '@/components/motion';
import { radius, spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

type StatTileProps = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'default' | 'highlight';
  // Makes the tile a button (with a small arrow) that opens the details.
  onPress?: () => void;
  accessibilityHint?: string;
};

export function StatTile({ label, value, icon, tone = 'default', onPress, accessibilityHint }: StatTileProps) {
  const styles = useStyles();
  const colors = useColors();
  const highlight = tone === 'highlight';
  const content = (
    <>
      {icon || onPress ? (
        <View style={styles.topRow}>
          {icon ? <Ionicons name={icon} size={18} color={highlight ? '#FFFFFF' : colors.primary} /> : <View />}
          {onPress ? (
            <Ionicons name="chevron-forward" size={16} color={highlight ? 'rgba(255,255,255,0.8)' : colors.textMuted} />
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.value, highlight && styles.highlightText]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, highlight && styles.highlightLabel]}>{label}</Text>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.three,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    padding: spacing.four,
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  highlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  highlightText: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 12,
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
