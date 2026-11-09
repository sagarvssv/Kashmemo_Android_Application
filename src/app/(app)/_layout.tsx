import { Stack } from 'expo-router';
import React from 'react';

export default function AppLayout() {
  return (
    // Detail screens push in with the iOS-style slide (with parallax and a
    // swipe-back gesture); forms rise from the bottom as sheets.
    <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right', gestureEnabled: true }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="raise-ticket" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="upload-bill" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="add-employee" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="upload-csv" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
