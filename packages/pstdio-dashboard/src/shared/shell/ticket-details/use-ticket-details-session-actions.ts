import { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { openTicketSessionBubble } from "@/features/ticket/utils/open-ticket-session-bubble";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";

export const useTicketDetailsSessionActions = (projectId?: string) => {
  const projectSettingsStore = useProjectSettingsStoreApi();
  const setSessionModalState = useProjectSettingsStore((state) => state.setSessionModalState);
  const setSelectedSessionId = useProjectSettingsStore((state) => state.setSelectedSessionId);

  const openSessionBubble = (sessionId: string | null | undefined) => {
    if (!sessionId) return;
    openTicketSessionBubble({
      sessionId,
      sessionModalState: projectSettingsStore.getState().sessionModalState,
      setSessionModalState,
      setSelectedSessionId,
    });
  };

  const pluginActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "ticket",
    onSuccess: async (result) => openSessionBubble(result.session_id),
  });

  const workspaceActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "workspace",
    onSuccess: async (result) => openSessionBubble(result.session_id),
  });

  const sessionActionTrigger = usePluginActionTrigger({
    projectId,
    targetType: "session",
    onSuccess: async (result) => openSessionBubble(result.session_id),
  });

  return {
    pluginActionTrigger,
    workspaceActionTrigger,
    sessionActionTrigger,
    openSessionBubble,
    setSelectedSessionId,
  };
};
