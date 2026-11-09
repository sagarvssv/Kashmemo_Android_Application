import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'kashmemo_auth_token';
const REFRESH_TOKEN_KEY = 'kashmemo_auth_token_refresh';
const USER_KEY = 'kashmemo_session_user';
// A device preference, so it is kept across sign-out.
const CURRENCY_KEY = 'kashmemo_currency';

// SecureStore is native-only; on web fall back to localStorage so the app is
// still usable in a browser during development.
async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing; the session stays in memory.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing to clean up.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type StoredTokens = { accessToken: string; refreshToken: string | null };

export async function readTokens(): Promise<StoredTokens | null> {
  const accessToken = await getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  return { accessToken, refreshToken: await getItem(REFRESH_TOKEN_KEY) };
}

export async function writeTokens(tokens: { accessToken: string; refreshToken?: string | null }) {
  await setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) {
    await setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function readStoredUser<T>(): Promise<T | null> {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeStoredUser(user: unknown) {
  await setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSessionStorage() {
  await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY), deleteItem(USER_KEY)]);
}

export function readCurrency(): Promise<string | null> {
  return getItem(CURRENCY_KEY);
}

export function writeCurrency(code: string): Promise<void> {
  return setItem(CURRENCY_KEY, code);
}
