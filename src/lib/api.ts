import { API_BASE_URL } from './config';
import { clearSessionStorage, readTokens, writeTokens } from './storage';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  // Public endpoints (login, signup, password reset) must not send or refresh tokens.
  auth?: boolean;
  responseType?: 'json' | 'text';
};

const REQUEST_TIMEOUT_MS = 20000;

let sessionExpiredHandler: (() => void) | null = null;

// The session provider registers this so a failed refresh logs the user out.
export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

function buildUrl(path: string, query?: Query) {
  const url = `${API_BASE_URL}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const candidate = (body as { message?: unknown; error?: unknown }).message ?? (body as { error?: unknown }).error;
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'That item could not be found.';
  return 'Something went wrong. Please try again.';
}

let refreshInFlight: Promise<string | null> | null = null;

// Exchanges the stored refresh token for a new pair. Concurrent 401s share a
// single refresh call because the backend rotates the refresh token on use.
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = await readTokens();
      if (!tokens?.refreshToken) return null;
      try {
        const response = await fetch(buildUrl('/api/org/refresh-token'), {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as { data?: { accessToken?: string; refreshToken?: string } };
        const accessToken = body.data?.accessToken;
        if (!accessToken) return null;
        await writeTokens({ accessToken, refreshToken: body.data?.refreshToken });
        return accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function send(path: string, options: RequestOptions, accessToken: string | null) {
  // ngrok's free plan answers browsers with an HTML "You are about to visit"
  // page instead of the API; this header skips it (needed for the web build,
  // harmless on phones, which never get that page).
  const headers: Record<string, string> = { Accept: 'application/json', 'ngrok-skip-browser-warning': '1' };
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  // fetch never times out on its own, so an unreachable backend would leave the
  // caller waiting forever (e.g. a login button stuck on "Signing in...").
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // credentials: 'omit' keeps the backend's auth cookies out of the picture so
    // the Bearer token in secure storage is the single source of truth.
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, `The server at ${API_BASE_URL} took too long to respond. Please try again.`);
    }
    throw new ApiError(0, `Unable to reach the server at ${API_BASE_URL}. Check your connection and try again.`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  let accessToken = useAuth ? (await readTokens())?.accessToken ?? null : null;

  let response = await send(path, options, accessToken);

  if (response.status === 401 && useAuth) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      await clearSessionStorage();
      sessionExpiredHandler?.();
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
    response = await send(path, options, accessToken);
  }

  // ngrok answers with its own HTML error page (e.g. ERR_NGROK_3200) when the
  // tunnel to the backend is not running, which would otherwise read as a 404.
  const ngrokError = response.headers.get('ngrok-error-code');
  if (ngrokError) {
    throw new ApiError(
      response.status,
      `The backend tunnel at ${API_BASE_URL} is offline (${ngrokError}). Start it with "ngrok http 3000" and try again.`,
    );
  }

  if (options.responseType === 'text') {
    const text = await response.text();
    if (!response.ok) throw new ApiError(response.status, messageFrom(null, response.status));
    return text as T;
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // Some error responses have an empty or non-JSON body.
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(parsed, response.status), parsed);
  }
  return parsed as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
