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
import { createReviewSession } from "./review-session";
import { initialState, playbackPosition, type ReviewChange, type ReviewState } from "./review-state";

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
  preview: (change: ReviewChange) => void;
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
  const session = useRef<ReturnType<typeof createReviewSession> | null>(null);
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    setError(undefined);
    const connection = createReviewSession(initialState(study), {
      read: () => client.commands["review.read"]({ study }),
      write: (change) => client.commands["review.update"]({ study, change }),
      onState: (snapshot) => {
        setState(snapshot);
        setReadyStudy(study);
      },
      onError: (reason) => setError(String(reason)),
    });
    session.current = connection;
    let lastTick = propsStore.get().lastCommand?.tick ?? 0;
    const unsubscribe = propsStore.subscribe((next) => {
      const event = next.lastCommand;
      if (!event || event.tick <= lastTick) return;
      lastTick = event.tick;
      if (event.extensionId === host.extensionId && event.commandId.endsWith(".review.update") && event.outcome.ok)
        void connection.refresh();
    });
    void connection.refresh();
    return () => {
      connection.dispose();
      unsubscribe();
    };
  }, [host, propsStore, study]);
  const preview = (change: ReviewChange) => session.current?.preview(change);
  const update = (change: ReviewChange) => session.current?.update(change) ?? Promise.resolve();
  return { state, preview, update, ready: readyStudy === study, error };
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
