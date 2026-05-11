import { useEffect, useState } from "react";
import { markAfterPaint } from "./mark-after-paint";

interface DeferredMountState {
  key: unknown;
  mounted: boolean;
}

export const useDeferredMount = (key?: unknown) => {
  const [state, setState] = useState<DeferredMountState>(() => ({ key, mounted: false }));
  const mounted = Object.is(state.key, key) ? state.mounted : false;

  useEffect(() => {
    setState((current) => (Object.is(current.key, key) && !current.mounted ? current : { key, mounted: false }));

    if (typeof requestAnimationFrame === "undefined") {
      setState({ key, mounted: true });
      return;
    }

    const id = requestAnimationFrame(() => setState({ key, mounted: true }));
    return () => cancelAnimationFrame(id);
  }, [key]);

  return mounted;
};

// Returns `true` after the next animation frame, and fires
// `markAfterPaint("app:<pageName>-page-ready")` whenever `key` changes.
//
// Wire the boolean to gate any heavy subtree (chat view, board view, ...) so the
// panel chrome paints first. Ignore the boolean if the panel just wants the
// perf-budget mark.
export const useDeferredPageMount = (pageName: string, key?: unknown) => {
  const mounted = useDeferredMount(key);

  useEffect(() => {
    void key;
    markAfterPaint(`app:${pageName}-page-ready`);
  }, [pageName, key]);

  return mounted;
};
