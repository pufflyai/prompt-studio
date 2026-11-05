import type { WorkbenchCore } from "@pstdio/workbench";
import type { NativeChatHostProps } from "@pstdio/workbench/extensions";
import { useSyncExternalStore } from "react";
import { useNativeHarnessAccount } from "@/shared/agents/use-native-harness-account";
import { composeNativeChatLinks } from "./native-chat-links";
import { useSessionLinks } from "./use-session-links";

export const createDashboardChatHost = (workbench: WorkbenchCore, projectId?: string) => {
  return function DashboardChatHost({ session, children, linkHandler }: NativeChatHostProps) {
    const { conversation, draft } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
    const links = useSessionLinks(workbench, projectId, conversation.workspaceId);
    const account = useNativeHarnessAccount({
      workbench,
      projectId,
      session,
      readOnly: conversation.readOnly,
      binding: conversation.nativeHarnessAccount,
      value: conversation.nativeHarnessAccount ? draft.values[conversation.nativeHarnessAccount.controlId] : undefined,
    });
    return children({
      linkHandler: conversation.nativeLinks ? composeNativeChatLinks(linkHandler, links.handler) : linkHandler,
      linkNotice: conversation.nativeLinks ? links.notice : undefined,
      account,
    });
  };
};
