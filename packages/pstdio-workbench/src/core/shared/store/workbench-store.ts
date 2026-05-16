import { devtools, type NamedSet } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

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
  setState: NamedSet<TState>;
  api: StoreApi<TState>;
}

export interface CreateWorkbenchStoreInput<TState> {
  name?: string;
  initialState: TState;
}

const defaultEquality = <TValue>(left: TValue, right: TValue) => Object.is(left, right);

export const createWorkbenchStore = <TState>(
  input: CreateWorkbenchStoreInput<TState>,
): InternalWorkbenchStore<TState> => {
  const api = createStore<TState>()(devtools(() => input.initialState, { name: input.name ?? "workbench.store" }));

  const subscribeSelector: WorkbenchStore<TState>["subscribeSelector"] = (selector, listener, options = {}) => {
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
