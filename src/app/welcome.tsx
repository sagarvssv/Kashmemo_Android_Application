import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GREEN_DEEP, BRAND_LIME, BrandLogo } from '@/components/brand-logo';
import { spacing, typography } from '@/constants/theme';
import { createStyles } from '@/context/theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'scan-outline', title: 'Scan your bills', text: 'Snap a photo and the details fill in for you.' },
  { icon: 'checkmark-done-outline', title: 'Quick approvals', text: 'Your manager and finance approve in a tap.' },
  { icon: 'wallet-outline', title: 'Get paid back', text: 'Track every bill from request to payout.' },
];

// First screen for signed-out users: the brand, what the app does, and the
// way in (log in, or register a company if you're its CEO).
export default function WelcomeScreen() {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="welcomeFill" x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0" stopColor={BRAND_GREEN} />
              <Stop offset="0.55" stopColor={BRAND_GREEN_DARK} />
              <Stop offset="1" stopColor={BRAND_GREEN_DEEP} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeFill)" />
          <Circle cx="92%" cy="8%" r="150" fill="#FFFFFF" fillOpacity={0.06} />
          <Circle cx="92%" cy="8%" r="90" fill="#FFFFFF" fillOpacity={0.05} />
          <Circle cx="0%" cy="58%" r="120" fill={BRAND_LIME} fillOpacity={0.06} />
        </Svg>
      </View>

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInUp.duration(600)} style={styles.brand}>
            <View style={styles.logoShadow}>
              <BrandLogo size={96} />
            </View>
            <Text style={styles.title}>KashMemo</Text>
            <Text style={styles.tagline}>Raise. Track. Get Paid.</Text>
          </Animated.View>

          <View style={styles.features}>
            {FEATURES.map((feature, index) => (
              <Animated.View
                key={feature.title}
                entering={FadeInDown.delay(200 + index * 110).duration(500)}
                style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={20} color={BRAND_GREEN_DARK} />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureBody}>{feature.text}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <Animated.View entering={FadeInDown.delay(560).duration(500)} style={styles.actions}>
            <Pressable
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryLabel}>Log in</Text>
              <Ionicons name="arrow-forward" size={18} color={BRAND_GREEN_DARK} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/signup')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Ionicons name="business-outline" size={18} color="#FFFFFF" />
              <Text style={styles.secondaryLabel}>Register your organisation</Text>
            </Pressable>
            <Text style={styles.note}>
              Registering is for your company&apos;s CEO only. Everyone else gets their login by email.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const useStyles = createStyles(() => ({
  container: {
    flex: 1,
    backgroundColor: BRAND_GREEN_DARK,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.five,
    paddingTop: spacing.eight,
    paddingBottom: spacing.five,
  },
  brand: {
    alignItems: 'center',
  },
  logoShadow: {
    borderRadius: 26,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    marginBottom: spacing.four,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  tagline: {
    ...typography.body,
    marginTop: spacing.one,
    color: BRAND_LIME,
    fontWeight: '600',
  },
  features: {
    gap: spacing.three,
    marginTop: spacing.eight,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_LIME,
  },
  featureText: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    ...typography.bodyStrong,
    color: '#FFFFFF',
  },
  featureBody: {
    ...typography.footnote,
    marginTop: 2,
    color: 'rgba(255,255,255,0.75)',
  },
  actions: {
    marginTop: 'auto',
    paddingTop: spacing.eight,
    gap: spacing.three,
  },
  primaryButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    backgroundColor: '#FFFFFF',
  },
  primaryLabel: {
    ...typography.button,
    color: BRAND_GREEN_DARK,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  secondaryLabel: {
    ...typography.button,
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
  note: {
    ...typography.caption,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
  },
}));
