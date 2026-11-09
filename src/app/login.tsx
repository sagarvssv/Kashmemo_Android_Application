import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { spacing } from '@/constants/theme';
import { useSession } from '@/context/session';
import { createStyles } from '@/context/theme';
import { haptics } from '@/lib/haptics';

export default function LoginScreen() {
  const styles = useStyles();
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Ionicons name="leaf" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>KashMemo</Text>
            <Text style={styles.tagline}>Raise. Track. Get Paid.</Text>
          </View>

          <View style={styles.form}>
            <TextField
              icon="mail-outline"
              placeholder="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TextField
              icon="lock-closed-outline"
              placeholder="Password"
              secureTextEntry={!showPassword}
              trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onTrailingIconPress={() => setShowPassword((prev) => !prev)}
              value={password}
              onChangeText={setPassword}
            />

            <Link href="/forgot-password" style={styles.forgotPassword}>
              Forgot password?
            </Link>

            <PrimaryButton
              label={isLoading ? 'Signing in...' : 'Log In'}
              onPress={handleLogin}
              disabled={!canSubmit}
              loading={isLoading}
            />

            <Text style={styles.signupRow}>
              <Text style={styles.signupText}>New to KashMemo? </Text>
              <Link href="/signup" style={styles.signupLink}>
                Register your organisation
              </Link>
            </Text>
            <Text style={styles.employeeHint}>
              Employees receive their login details from their organisation by email.
            </Text>
          </View>

          <Text style={styles.footer}>Powered by Your Organization</Text>
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
    justifyContent: 'center',
    paddingHorizontal: spacing.six,
    paddingVertical: spacing.eight,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.eight,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.four,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  signupRow: {
    textAlign: 'center',
    marginTop: spacing.two,
  },
  signupText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  employeeHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.four,
  },
}));
