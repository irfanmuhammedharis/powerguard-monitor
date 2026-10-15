import { useSyncExternalStore } from 'react';

/** Minimal observable store usable inside and outside React (no extra dependency). */
export interface Store<T extends object> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof T)[];
      if (keys.every(k => Object.is(state[k], patch[k]))) return;
      state = { ...state, ...patch };
      listeners.forEach(l => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Subscribes a component to a slice; select primitives or stable references. */
export function useStore<T extends object, S>(
  store: Store<T>,
  selector: (state: T) => S,
): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}
