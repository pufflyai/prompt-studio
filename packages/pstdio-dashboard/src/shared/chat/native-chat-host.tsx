import type { WorkbenchCore } from "@pstdio/workbench";
import type { NativeChatHostProps } from "@pstdio/workbench/extensions";
import { useSyncExternalStore } from "react";
import { useApiFileParts, useApiFileUrls } from "@/lib/api-file-url";
import { useNativeHarnessAccount } from "@/shared/agents/use-native-harness-account";
import { nativeChatFileAllowed } from "./native-chat-files";
import { composeNativeChatLinks } from "./native-chat-links";
import { useSessionLinks } from "./use-session-links";

export const createDashboardChatHost = (workbench: WorkbenchCore, projectId?: string) => {
  return function DashboardChatHost({
    session,
    values,
    attachments = [],
    extensionId,
    children,
    linkHandler,
  }: NativeChatHostProps) {
    const { conversation, messages: presented } = useSyncExternalStore(
      session.subscribe,
      session.getSnapshot,
      session.getSnapshot,
    );
    const messages = useApiFileParts(presented, (url) => nativeChatFileAllowed(url, projectId, extensionId));
    const attachmentUrls = useApiFileUrls([
      ...new Set(
        attachments.flatMap(({ url }) => (url && nativeChatFileAllowed(url, projectId, extensionId) ? [url] : [])),
      ),
    ]);
    const links = useSessionLinks(workbench, projectId, conversation.workspaceId);
    const account = useNativeHarnessAccount({
      workbench,
      projectId,
      session,
      readOnly: conversation.readOnly,
      binding: conversation.nativeHarnessAccount,
      value: conversation.nativeHarnessAccount ? values[conversation.nativeHarnessAccount.controlId] : undefined,
    });
    return children({
      messages,
      attachments: attachments.map((attachment) => ({
        ...attachment,
        ...(attachment.url && attachmentUrls.has(attachment.url) ? { url: attachmentUrls.get(attachment.url) } : {}),
      })),
      linkHandler: conversation.nativeLinks ? composeNativeChatLinks(linkHandler, links.handler) : linkHandler,
      linkNotice: conversation.nativeLinks ? links.notice : undefined,
      account,
    });
  };
};
