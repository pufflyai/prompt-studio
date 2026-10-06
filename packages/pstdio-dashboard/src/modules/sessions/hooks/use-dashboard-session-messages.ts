import { rendererReadKey } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { getCollection, subscribeCollections } from "@/lib/sync/collections";
import { createSessionHistoryController, type SessionHistoryState } from "../data/session-history-controller";

const emptyState: SessionHistoryState = { messages: [], loading: false, streaming: false };

export const nextStateForConnectionStart = (args: { current: SessionHistoryState; isSessionChange: boolean }) =>
  args.isSessionChange
    ? { messages: [], loading: true, streaming: false }
    : { ...args.current, loading: true, streaming: false };

export const useDashboardSessionMessages = (input: WorkbenchPanelRenderInput, sessionId: string | undefined) => {
  const [result, setResult] = useState<{ sessionId?: string; state: SessionHistoryState }>({ state: emptyState });
  const controller = useRef<ReturnType<typeof createSessionHistoryController> | undefined>(undefined);
  const lastResult = useRef(result);
  const ownerKey = rendererReadKey(input.instance, "session");
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
      transport: getApiClient().sessions,
      initialState: lastResult.current.sessionId === sessionId ? lastResult.current.state : undefined,
      initialSession: getCollection("sessions").get(sessionId),
      onChange: (state) => {
        lastResult.current = { sessionId, state };
        setResult(lastResult.current);
      },
    });
    const unsubscribe = subscribeCollections((change) => {
      if (!change) {
        current.connect();
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
  }, [sessionId, ownerKey, workbench]);
  return {
    ...(result.sessionId === sessionId ? result.state : { ...emptyState, loading: Boolean(sessionId) }),
    reconnect: () => controller.current?.connect(),
    refreshQueue: () => controller.current?.refreshQueue(),
  };
};
