import { rendererReadKey } from "@pstdio/workbench";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { getCollection, subscribeCollections } from "@/lib/sync/collections";
import { createSessionHistoryController, type SessionHistoryState } from "../data/session-history-controller";

export type DashboardSessionMessagesState = SessionHistoryState;
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
  useEffect(() => {
    if (!sessionId) {
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
    controller.current = current;
    current.connect();
    const unsubscribe = subscribeCollections((change) => {
      if (!change) {
        current.connect();
        return;
      }
      if (change.table === "sessions" && change.changes.some((row) => row.key === sessionId)) {
        current.sessionChanged(getCollection("sessions").get(sessionId));
      }
    });
    return () => {
      unsubscribe();
      current.dispose();
      if (controller.current === current) controller.current = undefined;
    };
  }, [sessionId, ownerKey, workbench]);
  return {
    ...(result.sessionId === sessionId ? result.state : { ...emptyState, loading: Boolean(sessionId) }),
    reconnect: () => controller.current?.connect(),
    retryHistory: () => controller.current?.retryHistory(),
    refreshQueue: () => controller.current?.refreshQueue(),
  };
};
