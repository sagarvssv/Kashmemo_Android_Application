import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { onSessionExpired, refreshAccessToken } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import { authApi, notificationApi } from '@/lib/endpoints';
import { clearSessionStorage, readStoredUser, readTokens, writeStoredUser, writeTokens } from '@/lib/storage';
import type { Profile, SessionUser } from '@/lib/types';

// Socket events the backend emits (see backend/src/services/realtime.service.ts).
export type RealtimeEvent =
  | 'notification'
  | 'activity'
  | 'ticket:created'
  | 'ticket:status-update'
  | 'budget:update'
  | 'employee:created'
  | 'employee:update';

type Listener = (payload: unknown) => void;

type SessionContextValue = {
  user: SessionUser | null;
  // The most recent signed-in user, kept through sign-out so screens that are
  // still animating away can finish rendering.
  lastUser: SessionUser | null;
  isReady: boolean;
  unreadCount: number;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  subscribe: (event: RealtimeEvent, listener: Listener) => () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const REALTIME_EVENTS: RealtimeEvent[] = [
  'notification',
  'activity',
  'ticket:created',
  'ticket:status-update',
  'budget:update',
  'employee:created',
  'employee:update',
];

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lastUser, setLastUser] = useState<SessionUser | null>(null);
  // Derived during render (not in an effect) so it never lags behind `user`.
  if (user && user !== lastUser) setLastUser(user);
  const [isReady, setIsReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const listeners = useRef(new Map<RealtimeEvent, Set<Listener>>());

  const persistUser = useCallback(async (next: SessionUser | null) => {
    setUser(next);
    if (next) await writeStoredUser(next);
  }, []);

  const applyProfile = useCallback((data: Profile) => {
    setUser((current) => {
      if (!current) return current;
      const next: SessionUser = {
        ...current,
        name: data.name,
        email: data.email,
        role: data.role,
        departmentId: data.departmentId,
        phoneNumber: data.phoneNumber,
        designation: data.designation,
        mustResetPassword: data.mustResetPassword,
      };
      void writeStoredUser(next);
      return next;
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data } = await authApi.profile();
    applyProfile(data);
  }, [applyProfile]);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationApi.unreadCount();
      setUnreadCount(typeof data === 'number' ? data : 0);
    } catch {
      // The badge is best-effort; screens surface their own errors.
    }
  }, []);

  const clearLocalSession = useCallback(async () => {
    await clearSessionStorage();
    setUser(null);
    setUnreadCount(0);
  }, []);

  // Restore a saved session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tokens, storedUser] = await Promise.all([readTokens(), readStoredUser<SessionUser>()]);
      if (!cancelled && tokens && storedUser) setUser(storedUser);
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionExpired(() => {
      setUser(null);
      setUnreadCount(0);
    });
    return () => onSessionExpired(null);
  }, []);

  // Keep the profile and the notification badge fresh whenever someone is signed in.
  const userId = user?.userId;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    authApi
      .profile()
      .then(({ data }) => {
        if (!cancelled) applyProfile(data);
      })
      .catch(() => {});
    notificationApi
      .unreadCount()
      .then(({ data }) => {
        if (!cancelled) setUnreadCount(typeof data === 'number' ? data : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, applyProfile]);

  // Live updates over Socket.IO. The backend authenticates with the access
  // token in the handshake, so a rejected handshake triggers one refresh.
  useEffect(() => {
    if (!userId) return;
    let triedRefresh = false;
    const socket: Socket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: (callback) => {
        readTokens().then((tokens) => callback({ token: tokens?.accessToken }));
      },
    });

    socket.on('connect', () => {
      triedRefresh = false;
    });
    socket.on('connect_error', async (error) => {
      if (triedRefresh || !error.message.startsWith('Authentication error')) return;
      triedRefresh = true;
      if (await refreshAccessToken()) socket.connect();
    });

    for (const event of REALTIME_EVENTS) {
      socket.on(event, (payload: unknown) => {
        if (event === 'notification') setUnreadCount((count) => count + 1);
        listeners.current.get(event)?.forEach((listener) => listener(payload));
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login(email, password);
      if (!data?.token?.accessToken) {
        throw new Error('The server response did not include an authentication token.');
      }
      await writeTokens(data.token);
      await persistUser({
        userId: data.userId,
        organizationId: data.organizationId,
        name: data.name,
        email: data.email,
        role: data.role,
        departmentId: data.department,
        companyName: data.companyName,
        plan: data.plan,
      });
    },
    [persistUser],
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear the local session even if the server is unreachable.
    }
    await clearLocalSession();
  }, [clearLocalSession]);

  const subscribe = useCallback((event: RealtimeEvent, listener: Listener) => {
    const set = listeners.current.get(event) ?? new Set<Listener>();
    set.add(listener);
    listeners.current.set(event, set);
    return () => {
      set.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({ user, lastUser, isReady, unreadCount, signIn, signOut, refreshProfile, refreshUnreadCount, subscribe }),
    [user, lastUser, isReady, unreadCount, signIn, signOut, refreshProfile, refreshUnreadCount, subscribe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

// Screens that are only reachable when signed in can rely on a user being present.
export function useCurrentUser(): SessionUser {
  const { user, lastUser } = useSession();
  const current = user ?? lastUser;
  if (!current) throw new Error('useCurrentUser called without a signed-in user');
  return current;
}

export function useRealtime(events: RealtimeEvent[], handler: Listener) {
  const { subscribe } = useSession();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  const key = events.join('|');

  useEffect(() => {
    const unsubscribers = key.split('|').map((event) =>
      subscribe(event as RealtimeEvent, (payload) => handlerRef.current(payload)),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [key, subscribe]);
}
