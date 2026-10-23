import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { getCollection, subscribeCollections } from "@/lib/sync/collections";
import { type SessionViewContext, sessionViewReadKey } from "../chat/session-view-context";
import { getSessionHistoryCache } from "../data/session-history-cache";
import { createSessionHistoryController, type SessionHistoryState } from "../data/session-history-controller";
import { visibleSessionMessages } from "../data/session-messages";

const emptyState: SessionHistoryState = { messages: [], loading: false, streaming: false };

export const useDashboardSessionMessages = (input: SessionViewContext, sessionId: string | undefined) => {
  const transport = getApiClient().sessions;
  const [result, setResult] = useState<{
    sessionId?: string;
    transport?: typeof transport;
    state: SessionHistoryState;
  }>({ state: emptyState });
  const controller = useRef<ReturnType<typeof createSessionHistoryController> | undefined>(undefined);
  const lastResult = useRef(result);
  const ownerKey = sessionViewReadKey(input);
  const workbench = input.workbench;
  useEffect(
    () => () => {
      controller.current?.dispose();
      controller.current = undefined;
    },
    [],
  );
  useEffect(() => {
    if (!sessionId) {
      controller.current?.dispose();
      controller.current = undefined;
      setResult({ state: emptyState });
      return;
    }
    const current = createSessionHistoryController({
      sessionId,
      ownerKey,
      reads: workbench.views.reads,
      transport,
      initialState:
        lastResult.current.sessionId === sessionId && lastResult.current.transport === transport
          ? lastResult.current.state
          : undefined,
      initialSession: getCollection("sessions").get(sessionId),
      onChange: (state) => {
        lastResult.current = { sessionId, transport, state };
        setResult(lastResult.current);
      },
    });
    const unsubscribe = subscribeCollections((change) => {
      if (!change) {
        current.reconnect();
        return;
      }
      if (change.table === "sessions" && change.changes.some((row) => row.key === sessionId)) {
        current.sessionChanged(getCollection("sessions").get(sessionId));
      }
    });
    const previous = controller.current;
    controller.current = {
      ...current,
      dispose() {
        unsubscribe();
        current.dispose();
      },
    };
    // Transfer the live subscription before releasing the old one, keeping the shared stream open.
    current.connect();
    previous?.dispose();
  }, [sessionId, ownerKey, workbench, transport]);
  const cached =
    sessionId && getSessionHistoryCache(transport).get(sessionId, getCollection("sessions").get(sessionId));
  const initialState = cached
    ? { ...emptyState, messages: visibleSessionMessages(cached) }
    : { ...emptyState, loading: Boolean(sessionId) };
  return {
    ...(result.sessionId === sessionId && result.transport === transport ? result.state : initialState),
    reconnect: () => controller.current?.reconnect(),
    refreshQueue: () => controller.current?.refreshQueue() ?? Promise.resolve(undefined),
  };
};
