import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { createStyles } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { humanize } from '@/lib/format';
import { INDUSTRY_TYPES, type IndustryType } from '@/lib/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const styles = useStyles();
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [industryType, setIndustryType] = useState<IndustryType | null>(null);
  const [country, setCountry] = useState('India');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordOk = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
  const canSubmit =
    companyName.trim().length > 1 &&
    ownerName.trim().length > 1 &&
    industryType !== null &&
    country.trim().length > 1 &&
    EMAIL_RE.test(email.trim()) &&
    passwordOk &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !industryType) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await authApi.signup({
        companyName: companyName.trim(),
        ownerName: ownerName.trim(),
        industryType,
        country: country.trim(),
        email: normalizedEmail,
        password,
      });
      router.replace({ pathname: '/verify-email', params: { email: normalizedEmail } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      title="Register your organisation"
      subtitle="You'll be the CEO account for your company"
      backFallback="/login"
      footer={
        <PrimaryButton label="Create account" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />
      }>
      <TextField label="Company name" icon="business-outline" value={companyName} onChangeText={setCompanyName} />
      <TextField label="Your full name" icon="person-outline" value={ownerName} onChangeText={setOwnerName} />
      <SelectField
        label="Industry"
        placeholder="Choose your industry"
        value={industryType}
        onChange={(value) => setIndustryType(value as IndustryType)}
        options={INDUSTRY_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
      />
      <TextField label="Country" icon="globe-outline" value={country} onChangeText={setCountry} />
      <TextField
        label="Work email"
        icon="mail-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        icon="lock-closed-outline"
        secureTextEntry={!showPassword}
        trailingIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
        onTrailingIconPress={() => setShowPassword((prev) => !prev)}
        value={password}
        onChangeText={setPassword}
      />
      <Text style={[styles.hint, password.length > 0 && !passwordOk && styles.hintError]}>
        At least 8 characters with an uppercase letter, a lowercase letter and a number.
      </Text>

      <InlineError message={error} />

      <Text style={styles.footerText}>
        Already registered?{' '}
        <Link href="/login" style={styles.link}>
          Log in
        </Link>
      </Text>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8,
  },
  hintError: {
    color: colors.danger,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
}));
