import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { CurrencyProvider } from '@/context/currency';
import { SessionProvider, useSession } from '@/context/session';
import { ThemeProvider } from '@/context/theme';

function RootNavigator() {
  const { user } = useSession();
  const isSignedIn = Boolean(user);

  // No manual navigation here: when a guard flips (sign-in, sign-out, expired
  // session), Stack.Protected redirects to the anchor route (`index`), which
  // then sends the user to /home or /login. Navigating here as well raced with
  // that redirect and could leave the login screen stuck on "Signing in...".

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="verify-email" />
      </Stack.Protected>

      {/* Password recovery also serves signed-in users who must replace a temporary password. */}
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="reset-password" />

      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </CurrencyProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
