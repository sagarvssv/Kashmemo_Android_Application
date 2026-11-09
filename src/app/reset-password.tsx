import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { goBackOrReplace } from '@/utils/navigation';

type Rule = {
  label: string;
  test: (value: string) => boolean;
};

const RULES: Rule[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /[0-9]/.test(value) },
];

export default function ResetPasswordScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { email, otp } = useLocalSearchParams<{ email: string; otp: string }>();
  const { user, refreshProfile } = useSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rulesPassed = RULES.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = rulesPassed && passwordsMatch && !isSubmitting;

  const handleReset = async () => {
    if (!canSubmit || !email || !otp) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await authApi.resetPassword(email, otp, password);
      // Leave the whole recovery flow (forgot password → code → new password)
      // before telling the user, so neither Back nor dismissing the alert can
      // land them on these screens again. dismissTo pops back to the screen
      // they started from (Profile or Login) instead of stacking a new one.
      if (user) {
        // Signed-in users (replacing a temporary password) go back to the app.
        await refreshProfile().catch(() => {});
        router.dismissTo('/profile');
        Alert.alert('Password updated', result.message);
      } else {
        router.dismissTo('/login');
        Alert.alert('Password updated', `${result.message}\n\nLog in with your new password.`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => goBackOrReplace('/login')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Set New Password</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>Create a new password for your account</Text>

        <TextField
          icon="lock-closed-outline"
          placeholder="New password"
          secureTextEntry={!showPassword}
          trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
          onTrailingIconPress={() => setShowPassword((prev) => !prev)}
          value={password}
          onChangeText={setPassword}
        />

        <TextField
          icon="lock-closed-outline"
          placeholder="Confirm new password"
          secureTextEntry={!showPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <View style={styles.rules}>
          {RULES.map((rule) => {
            const passed = rule.test(password);
            return (
              <View key={rule.label} style={styles.ruleRow}>
                <Ionicons
                  name={passed ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={16}
                  color={passed ? colors.success : colors.textSecondary}
                />
                <Text style={[styles.ruleLabel, passed && styles.ruleLabelPassed]}>
                  {rule.label}
                </Text>
              </View>
            );
          })}
        </View>

        <InlineError message={error} />

        <PrimaryButton label="Reset Password" onPress={handleReset} disabled={!canSubmit} loading={isSubmitting} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.four,
    paddingTop: spacing.three,
    gap: spacing.three,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: spacing.six,
    marginTop: spacing.eight,
    gap: spacing.four,
  },
  heading: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.two,
  },
  rules: {
    gap: spacing.two,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.two,
  },
  ruleLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  ruleLabelPassed: {
    color: colors.success,
  },
}));
