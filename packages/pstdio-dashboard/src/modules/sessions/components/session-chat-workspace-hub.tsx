import { ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { ComponentProps } from "react";
import { SessionWorkspaceControl } from "./session-workspace-control";

interface SessionChatWorkspaceHubProps
  extends ComponentProps<typeof SessionWorkspaceControl>,
    Pick<ComponentProps<typeof ChatWorkspaceHub>, "additions" | "deletions"> {}
export const SessionChatWorkspaceHub = (props: SessionChatWorkspaceHubProps) => {
  const { additions, deletions, ...workspace } = props;
  return (
    <ChatWorkspaceHub
      workspaceControl={<SessionWorkspaceControl {...workspace} />}
      additions={additions}
      deletions={deletions}
    />
  );
};
