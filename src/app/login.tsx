import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BrandLogo } from '@/components/brand-logo';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { iconBadge, spacing, typography } from '@/constants/theme';
import { useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { haptics } from '@/lib/haptics';

// One side margin for the hero, the card and the note under it, so their
// edges line up.
const GUTTER = spacing.five;
// Keeps the layout from stretching on tablets and wide screens.
const MAX_WIDTH = 480;

const HIGHLIGHTS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'scan-outline', label: 'Scan bills' },
  { icon: 'git-branch-outline', label: 'Quick approvals' },
  { icon: 'wallet-outline', label: 'Get paid' },
];

export default function LoginScreen() {
  const styles = useStyles();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // State updates are async, so a quick second tap could slip past `isLoading`
  // and fire a second login request. The ref blocks it synchronously.
  const submitting = useRef(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleLogin = async () => {
    if (!canSubmit || submitting.current) return;

    submitting.current = true;
    Keyboard.dismiss();
    setIsLoading(true);
    try {
      // The root navigator moves to the app once the session is stored.
      await signIn(email.trim(), password);
      haptics.success();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      if (message.toLowerCase().includes('verify your email')) {
        Alert.alert('Verify your email', message, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enter code',
            onPress: () => router.push({ pathname: '/verify-email', params: { email: email.trim() } }),
          },
        ]);
        return;
      }
      haptics.error();
      Alert.alert('Unable to log in', message);
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Brand hero: a gradient band with soft rings, running under the status bar. */}
          <View style={[styles.hero, { paddingTop: insets.top + spacing.six }]}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="heroFill" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={colors.primary} />
                    <Stop offset="1" stopColor={colors.accentTeal} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFill)" />
                <Circle cx="88%" cy="14%" r="110" fill="#FFFFFF" fillOpacity={0.07} />
                <Circle cx="88%" cy="14%" r="64" fill="#FFFFFF" fillOpacity={0.06} />
                <Circle cx="6%" cy="94%" r="90" fill="#FFFFFF" fillOpacity={0.05} />
              </Svg>
            </View>

            <Animated.View entering={FadeInUp.duration(500)} style={styles.brand}>
              <View style={styles.logoMark}>
                <BrandLogo size={64} />
              </View>
              <Text style={styles.title}>KashMemo</Text>
              <Text style={styles.tagline}>Raise. Track. Get Paid.</Text>

              <View style={styles.highlights}>
                {HIGHLIGHTS.map((item) => (
                  <View key={item.label} style={styles.highlight}>
                    <Ionicons name={item.icon} size={13} color="#FFFFFF" />
                    <Text style={styles.highlightText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>

          <View style={styles.body}>
            {/* Sign-in card, lifted over the bottom of the hero. */}
            <Animated.View entering={FadeInDown.delay(150).duration(550)} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: iconBadge(colors.primary) }]}>
                  <Ionicons name="lock-open-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.welcome}>Welcome back</Text>
                  <Text style={styles.welcomeSub}>Sign in to your workspace</Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextField
                  icon="mail-outline"
                  placeholder="you@company.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.field}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <Pressable
                    onPress={() => router.push('/forgot-password')}
                    hitSlop={8}
                    accessibilityRole="link">
                    <Text style={styles.forgotPassword}>Forgot password?</Text>
                  </Pressable>
                </View>
                <TextField
                  icon="lock-closed-outline"
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onTrailingIconPress={() => setShowPassword((prev) => !prev)}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                />
              </View>

              <PrimaryButton
                label={isLoading ? 'Signing in...' : 'Log In'}
                onPress={handleLogin}
                disabled={!canSubmit}
                loading={isLoading}
              />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>For CEOs only</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Registering creates the company and its CEO account, so it's
                  only for the CEO; everyone else is invited by their company. */}
              <PrimaryButton
                label="Register your organisation"
                variant="secondary"
                icon="business-outline"
                onPress={() => router.push('/signup')}
              />
              <Text style={styles.ceoNote}>
                Only your company&apos;s CEO registers the organisation.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(280).duration(500)} style={styles.hint}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.hintText}>
                Managers, finance and employees don&apos;t register. You get your login details from your
                organisation by email.
              </Text>
            </Animated.View>
          </View>

        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.four,
  },
  hero: {
    paddingHorizontal: GUTTER,
    // Room for the card that overlaps the bottom edge.
    paddingBottom: 72,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  brand: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logoMark: {
    borderRadius: 17,
    marginBottom: spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 0.3,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tagline: {
    ...typography.callout,
    marginTop: 2,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.two,
    marginTop: spacing.five,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  highlightText: {
    ...typography.captionStrong,
    color: '#FFFFFF',
  },
  // Card and note share one column, centred and capped in width.
  body: {
    width: '100%',
    maxWidth: MAX_WIDTH + GUTTER * 2,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  card: {
    marginTop: -48,
    padding: spacing.five,
    borderRadius: 24,
    backgroundColor: colors.surface,
    gap: spacing.four,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    marginBottom: spacing.one,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    ...typography.title,
    color: colors.textPrimary,
  },
  welcomeSub: {
    ...typography.footnote,
    color: colors.textMuted,
    marginTop: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    ...typography.footnoteStrong,
    color: colors.textPrimary,
  },
  forgotPassword: {
    ...typography.footnoteStrong,
    color: colors.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ceoNote: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: -spacing.two,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
    marginTop: spacing.four,
    paddingHorizontal: spacing.two,
  },
  hintText: {
    ...typography.caption,
    flex: 1,
    color: colors.textMuted,
  },
}));
