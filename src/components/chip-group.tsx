import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { motion } from '@/constants/motion';
import { spacing } from '@/constants/theme';
import { createStyles } from '@/context/theme';
import { haptics } from '@/lib/haptics';

type Option<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  // Wraps onto multiple lines instead of scrolling horizontally.
  wrap?: boolean;
};

export function ChipGroup<T extends string>({ options, value, onChange, wrap }: ChipGroupProps<T>) {
  const styles = useStyles();
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <PressableScale
        key={option.value}
        onPress={() => onChange(option.value)}
        haptic={selected ? undefined : 'select'}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[styles.chip, selected && styles.chipSelected]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
      </PressableScale>
    );
  });

  if (wrap) return <View style={styles.wrap}>{chips}</View>;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

// A full-width segmented control for 2–3 mutually exclusive views. The
// highlight slides between segments rather than jumping.
export function Segmented<T extends string>({ options, value, onChange }: ChipGroupProps<T>) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const segmentWidth = options.length ? (width - SEGMENT_PADDING * 2) / options.length : 0;

  const offset = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!segmentWidth) return;
    // Jump into place on first layout, slide on later changes.
    offset.set(placed.current ? withSpring(index * segmentWidth, motion.slideSpring) : index * segmentWidth);
    placed.current = true;
  }, [index, segmentWidth, offset]);
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  return (
    <View style={styles.segmented} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {segmentWidth > 0 && <Animated.View style={[styles.indicator, { width: segmentWidth }, indicatorStyle]} />}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => {
              if (!selected) haptics.select();
              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={styles.segment}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const SEGMENT_PADDING = 4;

const useStyles = createStyles((colors) => ({
  row: {
    gap: spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.two,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: SEGMENT_PADDING,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  indicator: {
    position: 'absolute',
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  segmentLabelSelected: {
    color: '#FFFFFF',
  },
}));
