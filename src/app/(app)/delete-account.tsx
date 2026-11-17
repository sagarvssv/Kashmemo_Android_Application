import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { spacing, typography } from '@/constants/theme';
import { useCurrentUser, useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { errorMessage } from '@/lib/api';
import { authApi } from '@/lib/endpoints';
import { haptics } from '@/lib/haptics';

// Deleting the organisation, required by Google Play and the App Store for
// accounts created in the app. Only the CEO registers, so only the CEO can
// delete: the whole organisation goes, confirmed with a code sent by email.
// Staff accounts belong to the organisation, which removes them from People.
export default function DeleteAccountScreen() {
  const user = useCurrentUser();
  return user.role === 'CEO' ? <DeleteOrganisation /> : <Redirect href="/profile" />;
}

function DeleteOrganisation() {
  const styles = useStyles();
  const user = useCurrentUser();
  const { signOut } = useSession();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.requestOrganisationDeletion();
      setCodeSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.confirmOrganisationDeletion(code.trim());
      haptics.success();
      Alert.alert('Organisation deleted', `${user.companyName ?? 'Your organisation'} and all its data have been deleted.`);
      await signOut();
    } catch (err) {
      haptics.error();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert(
      'Delete the whole organisation?',
      'Every account, department, budget, bill and cash request will be deleted for everyone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete everything', style: 'destructive', onPress: () => void remove() },
      ],
    );

  return (
    <Screen
      title="Delete organisation"
      backFallback="/profile"
      footer={
        codeSent ? (
          <PrimaryButton
            label="Delete organisation"
            variant="danger"
            icon="trash-outline"
            onPress={confirm}
            disabled={code.trim().length < 4}
            loading={busy}
          />
        ) : (
          <PrimaryButton label="Email me a code" icon="mail-outline" onPress={sendCode} loading={busy} />
        )
      }>
      <Warning />
      <Card style={styles.card}>
        <Text style={styles.body}>
          As the CEO, your account belongs to {user.companyName ?? 'your organisation'}. Deleting it deletes the whole
          organisation:
        </Text>
        <Point icon="close-circle" text="Every staff account and login" />
        <Point icon="close-circle" text="All departments and budgets" />
        <Point icon="close-circle" text="All bills, cash requests and payment records" />
        <Text style={[styles.body, styles.headingGap]}>
          Download any reports you need first. If you only want to leave, make someone else the head of the company
          instead.
        </Text>
      </Card>
      {codeSent ? (
        <View style={styles.field}>
          <Text style={styles.label}>Enter the code we sent to {user.email}</Text>
          <TextField
            icon="keypad-outline"
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={8}
            value={code}
            onChangeText={setCode}
          />
          <Text style={styles.resend} onPress={busy ? undefined : sendCode}>
            Send a new code
          </Text>
        </View>
      ) : null}
      <InlineError message={error} />
    </Screen>
  );
}

function Warning() {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.warning}>
      <Ionicons name="warning" size={22} color={colors.danger} />
      <Text style={styles.warningText}>This is permanent and cannot be undone.</Text>
    </View>
  );
}

function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={18} color={colors.danger} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: 14,
    backgroundColor: `${colors.danger}14`,
    borderWidth: 1,
    borderColor: `${colors.danger}55`,
  },
  warningText: {
    ...typography.calloutStrong,
    flex: 1,
    color: colors.danger,
  },
  card: {
    gap: spacing.two,
  },
  headingGap: {
    marginTop: spacing.two,
  },
  body: {
    ...typography.callout,
    color: colors.textPrimary,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.two,
  },
  pointText: {
    ...typography.callout,
    flex: 1,
    color: colors.textPrimary,
  },
  field: {
    gap: 6,
  },
  label: {
    ...typography.footnoteStrong,
    color: colors.textPrimary,
  },
  resend: {
    ...typography.footnoteStrong,
    color: colors.primary,
    alignSelf: 'flex-start',
    paddingVertical: spacing.one,
  },
}));
