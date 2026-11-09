import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, View } from 'react-native';

import { createStyles } from '@/context/theme';

const LENGTH = 6;

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  // Called with the full code as soon as the last digit is entered.
  onComplete?: (code: string) => void;
  hasError?: boolean;
};

// Six boxes backed by one hidden input. The single input holds the whole code,
// so typing, deleting, pasting and SMS autofill all behave like a normal text
// field; the boxes only display it.
export function OtpInput({ value, onChange, onComplete, hasError }: OtpInputProps) {
  const styles = useStyles();
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, LENGTH);
    onChange(digits);
    if (digits.length === LENGTH && value.length < LENGTH) {
      inputRef.current?.blur();
      onComplete?.(digits);
    }
  };

  // The box the next digit will go into (or the last box when full).
  const activeIndex = Math.min(value.length, LENGTH - 1);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={styles.row}>
      {Array.from({ length: LENGTH }, (_, index) => {
        const digit = value[index] ?? '';
        const isActive = focused && index === activeIndex;
        return (
          <View
            key={index}
            style={[styles.box, digit && styles.boxFilled, isActive && styles.boxActive, hasError && styles.boxError]}>
            <Text style={styles.digit}>{digit}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        autoFocus
        caretHidden
        accessibilityLabel={`Enter the ${LENGTH}-digit code`}
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxFilled: {
    borderColor: colors.textSecondary,
  },
  boxActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  digit: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  // Covers the boxes so taps reach it, but is invisible: the boxes show the code.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: 'transparent',
  },
}));
