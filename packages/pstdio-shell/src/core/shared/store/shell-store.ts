import { devtools, type NamedSet } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

export type ShellStoreSelector<TState, TValue> = (state: TState) => TValue;

export type ShellStoreListener<TState> = (state: TState, previousState: TState) => void;

export type ShellStoreSelectorListener<TValue> = (value: TValue, previousValue: TValue) => void;

export interface ShellStore<TState> {
  getState(): TState;
  getInitialState(): TState;
  subscribe(listener: ShellStoreListener<TState>): () => void;
  subscribeSelector<TValue>(
    selector: ShellStoreSelector<TState, TValue>,
    listener: ShellStoreSelectorListener<TValue>,
    options?: { equalityFn?: (left: TValue, right: TValue) => boolean; fireImmediately?: boolean },
  ): () => void;
}

export interface InternalShellStore<TState> extends ShellStore<TState> {
  setState: NamedSet<TState>;
  api: StoreApi<TState>;
}

export interface CreateShellStoreInput<TState> {
  name?: string;
  initialState: TState;
}

const defaultEquality = <TValue>(left: TValue, right: TValue) => Object.is(left, right);

export const createShellStore = <TState>(input: CreateShellStoreInput<TState>): InternalShellStore<TState> => {
  const api = createStore<TState>()(devtools(() => input.initialState, { name: input.name ?? "shell.store" }));

  const subscribeSelector: ShellStore<TState>["subscribeSelector"] = (selector, listener, options = {}) => {
    const equalityFn = options.equalityFn ?? defaultEquality;
    let previousValue = selector(api.getState());

    if (options.fireImmediately) listener(previousValue, previousValue);

    return api.subscribe((state) => {
      const nextValue = selector(state);
      if (equalityFn(previousValue, nextValue)) return;
      const previous = previousValue;
      previousValue = nextValue;
      listener(nextValue, previous);
    });
  };

  return {
    getState: api.getState,
    getInitialState: api.getInitialState,
    subscribe: api.subscribe,
    subscribeSelector,
    setState: api.setState,
    api,
  };
};
