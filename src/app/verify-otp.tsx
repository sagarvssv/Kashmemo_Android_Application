import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpInput } from '@/components/otp-input';
import { PrimaryButton } from '@/components/primary-button';
import { InlineError } from '@/components/states';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { haptics } from '@/lib/haptics';
import { goBackOrReplace } from '@/utils/navigation';

const RESEND_SECONDS = 45;

export default function VerifyOtpScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const canSubmit = otp.length === 6 && Boolean(email);

  // The code is checked by reset-password together with the new password
  // (the only reset route on every server), so here it just moves on; a wrong
  // code is reported on the next screen, which can come back here.
  // `code` is passed straight from the input when the last digit is typed,
  // because the `otp` state hasn't updated yet at that moment.
  // The ref blocks a second call in the same tick (auto-continue on the last
  // digit plus a tap on Continue), which would open the next screen twice.
  const verifyingRef = useRef(false);
  const handleVerify = (code: string = otp) => {
    if (code.length !== 6 || !email || verifyingRef.current) return;
    verifyingRef.current = true;
    setError(null);
    haptics.tap();
    // navigate (not push) reuses the screen if it is somehow already open.
    router.navigate({ pathname: '/reset-password', params: { email, otp: code } });
    setTimeout(() => {
      verifyingRef.current = false;
    }, 500);
  };

  const handleOtpChange = (next: string) => {
    setOtp(next);
    if (error) setError(null);
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || !email) return;
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setOtp('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const timerLabel = `00:${secondsLeft.toString().padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => goBackOrReplace('/login')} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify OTP</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.description}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>

        <OtpInput value={otp} onChange={handleOtpChange} onComplete={(code) => handleVerify(code)} hasError={Boolean(error)} />

        {secondsLeft > 0 ? (
          <Text style={styles.resendHint}>Resend OTP in {timerLabel}</Text>
        ) : (
          <Pressable onPress={handleResend}>
            <Text style={styles.resendLink}>Resend OTP</Text>
          </Pressable>
        )}

        <InlineError message={error} />

        <PrimaryButton label="Continue" onPress={() => handleVerify()} disabled={!canSubmit} />
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
    gap: spacing.five,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  email: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  resendHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  resendLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
}));
