import React, { useState } from 'react';
import { KeyboardAvoidingView, KeyboardTypeOptions, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { spacing } from '@/constants/theme';
import { createStyles } from '@/context/theme';
import { errorMessage } from '@/lib/api';

export type PromptField = {
  key: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  optional?: boolean;
};

type PromptModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  fields: PromptField[];
  confirmLabel: string;
  destructive?: boolean;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
};

// A small bottom sheet that collects one or more text values and runs an async
// action, keeping itself open with the server's message if the action fails.
export function PromptModal({ visible, onClose, ...sheetProps }: PromptModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Mounted only while open so every opening starts from the fields' initial values. */}
      {visible && <PromptSheet {...sheetProps} onClose={onClose} />}
    </Modal>
  );
}

function PromptSheet({
  title,
  message,
  fields,
  confirmLabel,
  destructive,
  onSubmit,
  onClose,
}: Omit<PromptModalProps, 'visible'>) {
  const styles = useStyles();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.initialValue ?? ''])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = fields.every((field) => field.optional || (values[field.key] ?? '').trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {fields.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            keyboardType={field.keyboardType}
            multiline={field.multiline}
            autoCapitalize={field.keyboardType === 'email-address' ? 'none' : 'sentences'}
            value={values[field.key] ?? ''}
            onChangeText={(text) => setValues((current) => ({ ...current, [field.key]: text }))}
          />
        ))}
        <InlineError message={error} />
        <View style={styles.actions}>
          <PrimaryButton label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
          <PrimaryButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            style={styles.action}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.six,
    paddingBottom: spacing.eight,
    gap: spacing.four,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  action: {
    flex: 1,
  },
}));
