import {
  createWebviewClient,
  type GuestHost,
  type PageLocation,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { commands } from "./commands";
import { defaultProps } from "./kit/model";
import { createReviewSession } from "./review-session";
import { initialState, playbackPosition, type ReviewChange, type ReviewState } from "./review-state";
import type { BuildError } from "./scene-builder";
import { studiesChanged } from "./study-events";
import type { StudyMetadata } from "./study-schema";
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
  study: StudyMetadata;
  hash: string;
  module: { code: string } | { error: BuildError };
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
  const id = props.resource?.id ?? props.pageLocation?.resource?.id ?? defaultProps.study;
  const [value, setValue] = useState<Omit<ReviewContextValue, "preview" | "update">>();
  const [error, setError] = useState<string>();
  const session = useRef<ReturnType<typeof createReviewSession> | null>(null);
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    let active = true;
    let version = 0;
    let definition: StudyMetadata | undefined;
    let loaded: { study: StudyMetadata; hash: string; module: { code: string } | { error: BuildError } } | undefined;
    setError(undefined);
    const connection = createReviewSession(initialState({ id, params: [] }), {
      duration: () => definition?.duration ?? 6,
      read: () => client.commands["review.read"]({ study: id }),
      write: (change) => client.commands["review.update"]({ study: id, change }),
      onState: (state) => {
        if (active && loaded) setValue({ ...loaded, state });
      },
      onError: (reason) => {
        if (active) setError(String(reason));
      },
    });
    session.current = connection;
    const refresh = async () => {
      const current = ++version;
      try {
        const result = await client.commands["study.read"]({ study: id });
        if (!active || current !== version) return;
        if (!result.ok) {
          setValue(undefined);
          setError(
            result.reason === "missing"
              ? "This study was deleted or does not exist."
              : result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
          );
          return;
        }
        definition = result.study;
        loaded = { study: result.study, hash: result.hash, module: result.module };
        setError(undefined);
        await connection.refresh();
      } catch (reason) {
        if (active && current === version) setError(String(reason));
      }
    };
    const unsubscribeEvent = client.events.subscribe(studiesChanged, () => void refresh());
    let lastTick = propsStore.get().lastCommand?.tick ?? 0;
    const unsubscribeProps = propsStore.subscribe((next) => {
      const event = next.lastCommand;
      if (!event || event.tick <= lastTick) return;
      lastTick = event.tick;
      if (event.extensionId === host.extensionId && event.commandId.endsWith(".review.update") && event.outcome.ok)
        void connection.refresh();
    });
    void refresh();
    return () => {
      active = false;
      connection.dispose();
      session.current = null;
      unsubscribeEvent();
      unsubscribeProps();
    };
  }, [host, propsStore, id]);
  const loading = value?.study.id !== id;
  return {
    value,
    loading,
    error,
    preview: (change: ReviewChange) => {
      if (!loading) session.current?.preview(change);
    },
    update: (change: ReviewChange) => {
      if (!loading) return session.current?.update(change) ?? Promise.resolve();
      return Promise.resolve();
    },
  };
};
export const usePlaybackPosition = (state: ReviewState, duration: number) => {
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
  return playbackPosition(state, Math.max(now, state.startedAt), duration);
};
