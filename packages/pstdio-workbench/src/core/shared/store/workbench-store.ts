import { devtools, type NamedSet } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";
import { notifyWorkbenchChange } from "./workbench-batch";

export type WorkbenchStoreSelector<TState, TValue> = (state: TState) => TValue;

export type WorkbenchStoreListener<TState> = (state: TState, previousState: TState) => void;

export type WorkbenchStoreSelectorListener<TValue> = (value: TValue, previousValue: TValue) => void;

export interface WorkbenchStore<TState> {
  getState(): TState;
  getInitialState(): TState;
  subscribe(listener: WorkbenchStoreListener<TState>): () => void;
  subscribeSelector<TValue>(
    selector: WorkbenchStoreSelector<TState, TValue>,
    listener: WorkbenchStoreSelectorListener<TValue>,
    options?: { equalityFn?: (left: TValue, right: TValue) => boolean; fireImmediately?: boolean },
  ): () => void;
}

export interface InternalWorkbenchStore<TState> extends WorkbenchStore<TState> {
  /** Release observation while the domain owner finishes any pending work. */
  dispose(): void;
  setState: NamedSet<TState>;
  api: StoreApi<TState>;
}

export interface CreateWorkbenchStoreInput<TState> {
  name?: string;
  initialState: TState;
}

const transitionSubscriptions = new WeakMap<object, (listener: () => void) => () => void>();
const disposals = new WeakMap<object, () => void>();

/** The core owns observation of its public read-only store facades. */
export const disposeWorkbenchStore = (store: object) => disposals.get(store)?.();

/** Lifecycle guards observe each committed transition, before UI notifications are batched. */
export const observeWorkbenchStoreTransitions = <TState>(store: WorkbenchStore<TState>, listener: () => void) => {
  const subscribe = transitionSubscriptions.get(store);
  if (!subscribe) throw new Error("Unknown workbench store");
  return subscribe(listener);
};

const defaultEquality = <TValue>(left: TValue, right: TValue) => Object.is(left, right);

export const createWorkbenchStore = <TState>(
  input: CreateWorkbenchStoreInput<TState>,
): InternalWorkbenchStore<TState> => {
  const api = createStore<TState>()(devtools(() => input.initialState, { name: input.name ?? "workbench.store" }));

  const subscriptions = new Set<() => void>();
  let disposed = false;
  const observe: typeof api.subscribe = (listener) => {
    if (disposed) return () => {};
    const stop = api.subscribe(listener);
    subscriptions.add(stop);
    return () => {
      stop();
      subscriptions.delete(stop);
    };
  };
  const subscribe: WorkbenchStore<TState>["subscribe"] = (listener) => {
    if (disposed) return () => {};
    const owner = {};
    let active = true;
    const stop = api.subscribe((_state, previous) =>
      notifyWorkbenchChange(owner, () => {
        if (active) listener(api.getState(), previous);
      }),
    );
    const release = () => {
      active = false;
      stop();
      subscriptions.delete(release);
    };
    subscriptions.add(release);
    return release;
  };

  const subscribeSelector: WorkbenchStore<TState>["subscribeSelector"] = (selector, listener, options = {}) => {
    if (disposed) return () => {};
    const equalityFn = options.equalityFn ?? defaultEquality;
    let previousValue = selector(api.getState());

    if (options.fireImmediately) listener(previousValue, previousValue);

    return subscribe((state) => {
      const nextValue = selector(state);
      if (equalityFn(previousValue, nextValue)) return;
      const previous = previousValue;
      previousValue = nextValue;
      listener(nextValue, previous);
    });
  };

  const store = {
    getState: api.getState,
    getInitialState: api.getInitialState,
    subscribe,
    subscribeSelector,
    setState: api.setState,
    api,
    dispose() {
      disposed = true;
      for (const stop of subscriptions) stop();
      subscriptions.clear();
    },
  };
  transitionSubscriptions.set(store, (listener) => observe(listener));
  disposals.set(store, store.dispose);
  return store;
};
