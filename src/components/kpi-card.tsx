import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';

// Pastel icon chips, as on the web dashboards' KPI cards.
const KPI_TONES = {
  teal: { background: '#e1f5ee', icon: '#085041' },
  terracotta: { background: '#faece7', icon: '#993c1d' },
  indigo: { background: '#eeedfe', icon: '#3c3489' },
  blue: { background: '#e6f1fb', icon: '#0c447c' },
} as const;

export type KpiTone = keyof typeof KPI_TONES;

type KpiCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  tone: KpiTone;
  value: string;
  label: string;
  link: string;
  href: Href;
  // Filled with the brand colour (dark green for CEO/HR) to lead the grid.
  highlight?: boolean;
};

// A tappable headline number that opens the screen with the detail behind it.
export function KpiCard({ icon, tone, value, label, link, href, highlight }: KpiCardProps) {
  const styles = useStyles();
  const colors = useColors();
  const palette = KPI_TONES[tone];
  return (
    <PressableScale
      haptic="tap"
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. ${link}`}
      style={({ pressed }) => [
        styles.kpi,
        highlight && styles.kpiHighlight,
        pressed && (highlight ? styles.kpiHighlightPressed : styles.kpiPressed),
      ]}>
      <View style={[styles.kpiIcon, { backgroundColor: highlight ? 'rgba(255,255,255,0.16)' : palette.background }]}>
        <Ionicons name={icon} size={18} color={highlight ? '#FFFFFF' : palette.icon} />
      </View>
      <Text style={[styles.kpiValue, highlight && styles.onHighlight]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, highlight && styles.onHighlightMuted]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.kpiLink}>
        <Text style={[styles.kpiLinkText, highlight && styles.onHighlight]}>{link}</Text>
        <Ionicons name="chevron-forward" size={14} color={highlight ? '#FFFFFF' : colors.info} />
      </View>
    </PressableScale>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.grid}>{children}</View>;
}

const useStyles = createStyles((colors) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.three,
  },
  kpi: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.four,
    gap: 6,
  },
  kpiPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  kpiHighlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  kpiHighlightPressed: {
    opacity: 0.85,
  },
  onHighlight: {
    color: '#FFFFFF',
  },
  onHighlightMuted: {
    color: 'rgba(255,255,255,0.8)',
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.two,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    minHeight: 32,
  },
  kpiLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  kpiLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info,
  },
}));
