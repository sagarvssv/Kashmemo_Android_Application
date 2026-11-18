import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const BACKEND_PORT = 3000;

// EXPO_PUBLIC_API_URL wins whenever it is set (.env.local in development,
// eas.json in builds), on phones and emulators alike. Without it, an Android
// emulator in development reaches the developer's machine at 10.0.2.2 (the
// local backend), and anything else reuses the host Metro is served from.
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (__DEV__ && Platform.OS === 'android' && !Device.isDevice) {
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  // `expo start --tunnel` serves Metro from an Expo tunnel domain that does not
  // forward the backend port, so requests to it would just time out.
  if (host && !/^[\d.]+$/.test(host) && host !== 'localhost') {
    console.warn(
      `Metro is running through a tunnel (${host}), which cannot reach the backend. ` +
        'Set EXPO_PUBLIC_API_URL in .env, or run `npx expo start` without --tunnel.',
    );
  }
  if (host) return `http://${host}:${BACKEND_PORT}`;

  if (Platform.OS === 'android') return `http://10.0.2.2:${BACKEND_PORT}`;
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

// Petty Cash Invoice API that reads bill photos (see lib/invoices.ts). Kept in
// config because it differs per environment; empty turns bill reading off.
export const INVOICE_API_URL = (process.env.EXPO_PUBLIC_INVOICE_API_URL ?? '').replace(/\/+$/, '');

export const LOCALE = 'en-IN';
