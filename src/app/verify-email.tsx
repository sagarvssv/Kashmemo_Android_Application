import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text } from 'react-native';

import { OtpInput } from '@/components/otp-input';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { InlineError } from '@/components/states';
import { createStyles } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';

export default function VerifyEmailScreen() {
  const styles = useStyles();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6 || !email) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await authApi.verifyEmail(email, otp);
      Alert.alert('Email verified', data?.message ?? 'You can now log in.', [
        { text: 'Log in', onPress: () => router.replace('/login') },
      ]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen title="Verify your email" backFallback="/login">
      <Text style={styles.description}>
        Enter the 6-digit code we sent to{'\n'}
        <Text style={styles.email}>{email}</Text>
      </Text>
      <OtpInput value={otp} onChange={setOtp} />
      <Text style={styles.hint}>The code is valid for 10 minutes.</Text>
      <InlineError message={error} />
      <PrimaryButton label="Verify email" onPress={handleVerify} disabled={otp.length !== 6} loading={isSubmitting} />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  email: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
}));
