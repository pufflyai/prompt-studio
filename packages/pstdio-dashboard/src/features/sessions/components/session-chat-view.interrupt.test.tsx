import { describe, expect, it, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

type CapturedChatPanelProps = {
  onInterrupt?: () => void;
  streaming?: boolean;
};

let capturedChatPanelProps: CapturedChatPanelProps | undefined;
const stopSessionMutate = mock(() => {});

mock.module("@pstdio/ui/chat-ui", () => ({
  ChatPanel: (props: CapturedChatPanelProps) => {
    capturedChatPanelProps = props;
    return null;
  },
  ChatSkeleton: () => null,
}));

mock.module("@tanstack/react-router", () => ({
  useParams: () => ({ projectId: "project-1" }),
}));

mock.module("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

mock.module("@/features/agents/components/agent-browser.container", () => ({
  AgentBrowserContainer: () => null,
}));

mock.module("@/features/workspaces/components/repo-browser.container", () => ({
  RepoBrowserContainer: () => null,
}));

mock.module("@/features/project-settings/store", () => ({
  useProjectSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      lastSelectedAgent: null,
      lastSelectedModels: [],
      setSessionDraft: () => {},
      clearSessionDraft: () => {},
    }),
  useProjectSettingsStoreApi: () => ({
    getState: () => ({ chatDraftsBySession: {} }),
  }),
}));

mock.module("@/features/ticket/hooks/use-ticket-attempt-diff-summary", () => ({
  useTicketAttemptDiffSummary: () => ({ data: null }),
}));

mock.module("../hooks/use-create-project-session", () => ({
  useCreateProjectSession: () => ({ mutate: () => {} }),
}));

mock.module("../hooks/use-follow-up-session", () => ({
  useFollowUpSession: () => ({ mutate: () => {} }),
}));

mock.module("../hooks/use-session-agent", () => ({
  useSessionAgent: () => null,
}));

mock.module("../hooks/use-session-status", () => ({
  useSessionStatus: () => "in_progress",
}));

mock.module("../hooks/use-session-stream", () => ({
  useSessionStream: () => ({
    messages: [],
    isStreaming: true,
    approvalRequest: null,
    reconnect: () => {},
  }),
}));

mock.module("../hooks/use-session-workspace", () => ({
  useSessionWorkspace: () => null,
}));

mock.module("../utils/workspace-hub", () => ({
  buildSessionWorkspaceHubPanelModel: () => null,
}));

mock.module("./session-chat-view-hooks", () => ({
  useEditActionNotifier: () => {},
  useReconnectOnExternalResume: () => {},
  useReconnectWhenWorkspaceReady: () => {},
  useResetEditCountOnSessionChange: () => {},
  useSyncPendingFollowUp: () => {},
}));

mock.module("./session-chat-view-actions", () => ({
  submitSessionMessage: () => {},
}));

mock.module("./session-chat-view-panels", () => ({
  SessionChatApprovalPromptPanel: () => null,
  SessionChatWorkspaceHubPanel: () => null,
}));

describe("SessionChatView interrupt integration", () => {
  it("renders chat in stop mode and forwards interrupt requests", async () => {
    capturedChatPanelProps = undefined;
    stopSessionMutate.mockClear();

    const { SessionChatView } = await import("./session-chat-view");
    renderToStaticMarkup(
      <SessionChatView
        sessionId="session-1"
        isStopPending={false}
        hasRequestedStop={() => false}
        requestStopSession={stopSessionMutate}
      />,
    );

    expect(capturedChatPanelProps).toBeDefined();
    const chatPanelProps = capturedChatPanelProps!;

    expect(chatPanelProps.streaming).toBe(true);
    expect(chatPanelProps.onInterrupt).toBeTypeOf("function");

    chatPanelProps.onInterrupt?.();
    chatPanelProps.onInterrupt?.();

    expect(stopSessionMutate).toHaveBeenCalledTimes(2);
    expect(stopSessionMutate).toHaveBeenCalledWith("session-1");
  });
});
