import { useEffect } from "react";
import { useProjectSettingsStore } from "@/shared/stores/project-settings";
import { resolvePendingWorkspaceSessionWorkspaceId } from "./workspace-page.utils";

export const useWorkspaceSessionDraft = (selectedWorkspaceId: string | null) => {
  const sessionModalState = useProjectSettingsStore((state) => state.sessionModalState);
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);
  const setPendingWorkspaceSessionWorkspaceId = useProjectSettingsStore(
    (state) => state.setPendingWorkspaceSessionWorkspaceId,
  );
  const pendingWorkspaceSessionWorkspaceId = useProjectSettingsStore(
    (state) => state.pendingWorkspaceSessionWorkspaceId,
  );

  useEffect(() => {
    const nextPendingWorkspaceSessionWorkspaceId = resolvePendingWorkspaceSessionWorkspaceId(
      pendingWorkspaceSessionWorkspaceId,
      selectedWorkspaceId,
    );

    if (nextPendingWorkspaceSessionWorkspaceId !== pendingWorkspaceSessionWorkspaceId) {
      setPendingWorkspaceSessionWorkspaceId(nextPendingWorkspaceSessionWorkspaceId);
    }
  }, [pendingWorkspaceSessionWorkspaceId, selectedWorkspaceId, setPendingWorkspaceSessionWorkspaceId]);

  useEffect(
    () => () => {
      setPendingWorkspaceSessionWorkspaceId(null);
    },
    [setPendingWorkspaceSessionWorkspaceId],
  );

  return (workspaceId: string) => {
    if (sessionModalState === "closed") {
      setSessionModalState("bubble");
    }

    setSelectedSessionId(null);
    setPendingWorkspaceSessionWorkspaceId(workspaceId);
  };
};
