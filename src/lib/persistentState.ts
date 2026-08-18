import { useCallback, useEffect, useState } from "react";

/**
 * Estado global simples persistido em localStorage.
 * Usado para manter os filtros ao trocar de aba dentro de um módulo.
 */
const store = new Map<string, unknown>();
const listeners = new Map<string, Set<(v: unknown) => void>>();

function read<T>(key: string, initial: T): T {
  if (store.has(key)) return store.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as T;
      store.set(key, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  store.set(key, initial);
  return initial;
}

export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (typeof window === "undefined" ? initial : read(key, initial)));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setValue(read(key, initial));
    const set = listeners.get(key) ?? new Set();
    const fn = (v: unknown) => setValue(v as T);
    set.add(fn);
    listeners.set(key, set);
    return () => {
      set.delete(fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, initial);
      const val = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      store.set(key, val);
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        /* ignore */
      }
      listeners.get(key)?.forEach((fn) => fn(val));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, update] as const;
}
