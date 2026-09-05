import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (next: T) => void;
}

/**
 * Runs `fetcher` on mount and whenever `deps` change.
 *
 * Responses from a superseded call are dropped: filters change faster than the
 * network answers, and without the guard a slow first request can overwrite
 * the results of a newer one.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const callId = useRef(0);
  const fetcherRef = useRef(fetcher);

  // Declared first, so it has already run by the time the effect below fires
  // on the same commit - React runs effects in declaration order.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (id !== callId.current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (id !== callId.current) return;
        setError(errorMessage(cause));
      })
      .finally(() => {
        if (id !== callId.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload, setData };
}

/**
 * Wraps a mutation so a page never repeats the try/catch/toast dance.
 * `run` resolves to the value on success and to `undefined` on failure.
 */
export function useAction(handlers: {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await fn();
        if (successMessage) handlersRef.current.onSuccess?.(successMessage);
        return result;
      } catch (cause) {
        handlersRef.current.onError?.(errorMessage(cause));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return { busy, run };
}

/** Delays a fast-changing value (a search box) before it hits the API. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
