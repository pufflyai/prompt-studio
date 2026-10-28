import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import { useEffect, useRef, useState } from "react";
import { readRecentHarnessSelection } from "@/shared/command-params/recent-harness-param";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { resolveSessionSelectionSync } from "../runtime/session-runtime-selection";

// The chat panel is keyed by its view, so these picks always belong to one session or draft.
export const useSessionModelSelection = (view: DashboardSessionView, projectId: string | undefined) => {
  const [recent] = useState(() => (view.sessionId ? undefined : readRecentHarnessSelection(projectId)));
  const [selectedAgent, setSelectedAgent] = useState(view.agent ?? recent?.harnessId ?? "");
  const [selectedModel, setSelectedModel] = useState(view.lastSelectedModel ?? (view.agent ? "" : recent?.model) ?? "");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(view.workspaceId ?? "");
  const [harnessParamOverrides, setHarnessParamOverrides] = useState<HarnessParamValues>(
    view.sessionId || view.agent ? (view.params ?? {}) : (recent?.params ?? {}),
  );
  const previousViewRef = useRef(view);

  useEffect(() => {
    const previous = previousViewRef.current;
    previousViewRef.current = view;
    const updates = resolveSessionSelectionSync(previous, view);
    if (updates.agent !== undefined) setSelectedAgent(updates.agent);
    if (updates.model !== undefined) setSelectedModel(updates.model);
    if (updates.workspaceId !== undefined) setSelectedWorkspaceId(updates.workspaceId);
    if (updates.params !== undefined) setHarnessParamOverrides(updates.params);
  }, [view]);

  return {
    selectedAgent,
    setSelectedAgent,
    selectedModel,
    setSelectedModel,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    harnessParamOverrides,
    setHarnessParamOverrides,
  };
};
