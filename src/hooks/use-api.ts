import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { errorMessage } from '@/lib/api';

type ApiState<T> = {
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: (updater: (current: T | undefined) => T | undefined) => void;
};

// Runs `fetcher` whenever the screen gains focus or `deps` change.
// `reload` refetches quietly; `refresh` drives a pull-to-refresh spinner.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // The deps key of the last request that finished; loading until it matches.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  const requestId = useRef(0);
  const depsKey = JSON.stringify(deps);
  const keyRef = useRef(depsKey);

  useEffect(() => {
    fetcherRef.current = fetcher;
    keyRef.current = depsKey;
  });

  const run = useCallback(async () => {
    const id = ++requestId.current;
    const key = keyRef.current;
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setSettledKey(key);
    }
  }, []);

  useEffect(() => {
    keyRef.current = depsKey;
    void run();
  }, [depsKey, run]);

  const isLoading = settledKey !== depsKey;

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // The mount effect already covers the first focus.
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void run();
    }, [run]),
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await run();
    setIsRefreshing(false);
  }, [run]);

  const setData = useCallback((updater: (current: T | undefined) => T | undefined) => {
    setDataState((current) => updater(current));
  }, []);

  return { data, error, isLoading, isRefreshing, reload: run, refresh, setData };
}

type CursorResponse<T> = { data: T[]; nextCursor: string | null };

type CursorListState<T> = {
  items: T[];
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
  setItems: (updater: (current: T[]) => T[]) => void;
};

// Cursor pagination matching the backend's `{ data, nextCursor }` responses.
export function useCursorList<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorResponse<T>>,
  deps: unknown[] = [],
): CursorListState<T> {
  const [page, setPage] = useState<{ key: string | null; items: T[]; cursor: string | null }>({
    key: null,
    items: [],
    cursor: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const fetchRef = useRef(fetchPage);
  const requestId = useRef(0);
  const depsKey = JSON.stringify(deps);
  const keyRef = useRef(depsKey);

  useEffect(() => {
    fetchRef.current = fetchPage;
    keyRef.current = depsKey;
  });

  const loadFirstPage = useCallback(async () => {
    const id = ++requestId.current;
    const key = keyRef.current;
    try {
      const response = await fetchRef.current(undefined);
      if (id !== requestId.current) return;
      setPage({ key, items: response.data ?? [], cursor: response.nextCursor ?? null });
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err));
      setPage((current) => (current.key === key ? current : { key, items: [], cursor: null }));
    }
  }, []);

  useEffect(() => {
    keyRef.current = depsKey;
    void loadFirstPage();
  }, [depsKey, loadFirstPage]);

  // Results from a previous filter are never shown under the current one.
  const isLoading = page.key !== depsKey;
  const items = isLoading ? [] : page.items;
  const cursor = isLoading ? null : page.cursor;

  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      void loadFirstPage();
    }, [loadFirstPage]),
  );

  const loadMore = useCallback(async () => {
    if (!cursor || isLoadingMore) return;
    const id = requestId.current;
    setIsLoadingMore(true);
    try {
      const response = await fetchRef.current(cursor);
      if (id !== requestId.current) return;
      setPage((current) => ({
        ...current,
        items: [...current.items, ...(response.data ?? [])],
        cursor: response.nextCursor ?? null,
      }));
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      setIsLoadingMore(false);
    }
  }, [cursor, isLoadingMore]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFirstPage();
    setIsRefreshing(false);
  }, [loadFirstPage]);

  const setItems = useCallback((updater: (current: T[]) => T[]) => {
    setPage((current) => ({ ...current, items: updater(current.items) }));
  }, []);

  return {
    items,
    error,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore: cursor !== null,
    loadMore,
    refresh,
    reload: loadFirstPage,
    setItems,
  };
}
