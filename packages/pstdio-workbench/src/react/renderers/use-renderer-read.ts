import { useEffect, useRef, useState } from "react";
import type { Disposable, RendererReadBinding, WorkbenchCore } from "../../core";

interface RendererReadOptions<T> {
  workbench: WorkbenchCore;
  ownerKey: string;
  queryKey: string;
  load(signal: AbortSignal): Promise<T> | T;
  subscribe(listener: () => void): Disposable | (() => void);
}

interface ReadState<T> {
  queryKey: string;
  value?: T;
  loading: boolean;
  error?: string;
}

export const useRendererRead = <T>(options: RendererReadOptions<T>) => {
  const { workbench, ownerKey, queryKey } = options;
  const [state, setState] = useState<ReadState<T>>({ queryKey, loading: true });
  const retryRef = useRef<(() => void) | undefined>(undefined);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  });
  // Query identity controls ownership. Rendering a new callback must not start another read.
  useEffect(() => {
    const binding: RendererReadBinding = workbench.views.reads.bind(ownerKey);
    const request = {
      queryKey,
      load: (signal: AbortSignal) => callbacks.current.load(signal),
      onValue: (value: T) => setState({ queryKey, value, loading: false }),
      onError: (error: unknown) =>
        setState((previous) => ({
          queryKey,
          value: previous.queryKey === queryKey ? previous.value : undefined,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        })),
    };
    const refresh = () => binding.request(request);
    retryRef.current = () => {
      setState((previous) => ({ ...previous, loading: true, error: undefined }));
      binding.request(request, "retry");
    };
    refresh();
    const subscription = callbacks.current.subscribe(refresh);
    return () => {
      retryRef.current = undefined;
      binding.dispose();
      if (typeof subscription === "function") subscription();
      else subscription.dispose();
    };
  }, [workbench, ownerKey, queryKey]);
  const current = state.queryKey === queryKey ? state : { queryKey, loading: true };
  return { ...current, retry: () => retryRef.current?.() };
};
