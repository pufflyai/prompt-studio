import { defaultProps, type StudyId } from "@pstdio/motion-studies";
import {
  createWebviewClient,
  type GuestHost,
  type PageLocation,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { commands } from "./commands";
import { applyReviewChange, initialState, playbackPosition, type ReviewChange, type ReviewState } from "./review-state";

export interface ReviewProps {
  resource?: ResourceRef;
  pageLocation?: PageLocation;
  lastCommand?: {
    commandId: string;
    extensionId: string;
    outcome: { ok: boolean; value?: unknown };
    tick: number;
  } | null;
}
interface ReviewContextValue {
  state: ReviewState;
  update: (change: ReviewChange) => Promise<void>;
}
export const ReviewContext = createContext<ReviewContextValue | null>(null);
export const useReview = () => {
  const context = useContext(ReviewContext);
  if (!context) throw new Error("Missing animation review");
  return context;
};
export const useReviewConnection = (host: GuestHost, propsStore: PropsStore<ReviewProps>) => {
  const props = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
  const study = (props.resource?.id ?? props.pageLocation?.resource?.id ?? defaultProps.study) as StudyId;
  const [state, setState] = useState<ReviewState>(() => initialState(study));
  const [readyStudy, setReadyStudy] = useState<StudyId>();
  const [error, setError] = useState<string>();
  const client = createWebviewClient<typeof commands>(host);
  const writes = useRef({ queue: Promise.resolve(), pending: 0 });
  useEffect(() => {
    writes.current = { queue: Promise.resolve(), pending: 0 };
    let active = true;
    let lastTick = propsStore.get().lastCommand?.tick ?? 0;
    const accept = (value: unknown) => {
      const snapshot = value as ReviewState;
      if (active && snapshot?.settings?.study === study && writes.current.pending === 0) {
        setState(snapshot);
        setReadyStudy(study);
      }
    };
    const unsubscribe = propsStore.subscribe((next) => {
      const event = next.lastCommand;
      if (!event || event.tick <= lastTick) return;
      lastTick = event.tick;
      if (event.extensionId === host.extensionId && event.commandId.endsWith(".review.update") && event.outcome.ok)
        accept(event.outcome.value);
    });
    void createWebviewClient<typeof commands>(host)
      .commands["review.read"]({ study })
      .then(accept)
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, propsStore, study]);
  const update = (change: ReviewChange) => {
    const pending = writes.current;
    pending.pending += 1;
    setState((current) => applyReviewChange(current, change, Date.now()));
    pending.queue = pending.queue.then(async () => {
      try {
        const result = await client.commands["review.update"]({ study, change });
        if (pending.pending === 1) setState((current) => (current.settings.study === study ? result : current));
      } catch (reason) {
        setError(String(reason));
      } finally {
        pending.pending -= 1;
      }
    });
    return pending.queue;
  };
  return { state, update, ready: readyStudy === study, error };
};
export const usePlaybackPosition = (state: ReviewState) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!state.playing) return;
    let request: number;
    const tick = () => {
      setNow(Date.now());
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [state.playing]);
  return playbackPosition(state, Math.max(now, state.startedAt));
};
