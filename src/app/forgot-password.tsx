import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { goBackOrReplace } from '@/utils/navigation';

export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const colors = useColors();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const canSubmit = email.trim().length > 0 && !isSending;

  const handleSendOtp = async () => {
    if (!canSubmit) return;
    const normalizedEmail = email.trim().toLowerCase();
    setIsSending(true);
    setError(null);
    try {
      const result = await authApi.forgotPassword(normalizedEmail);
      if (!result.success) {
        setError(result.message);
        return;
      }
      router.push({ pathname: '/verify-otp', params: { email: normalizedEmail } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => goBackOrReplace('/login')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Forgot Password</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.heading}>Reset Your Password</Text>
        <Text style={styles.description}>
          Enter your email address and we&apos;ll send you a 6-digit OTP to reset your password.
        </Text>

        <TextField
          icon="mail-outline"
          placeholder="Email address"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          containerStyle={styles.field}
        />

        <InlineError message={error} />

        <PrimaryButton label="Send OTP" onPress={handleSendOtp} disabled={!canSubmit} loading={isSending} />

        <Link href="/login" style={styles.backLink}>
          Back to login
        </Link>
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
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.two,
  },
  field: {
    marginBottom: spacing.two,
  },
  backLink: {
    alignSelf: 'center',
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.two,
  },
}));
