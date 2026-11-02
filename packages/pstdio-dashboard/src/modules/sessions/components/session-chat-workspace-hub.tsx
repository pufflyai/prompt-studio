import { HStack } from "@chakra-ui/react";
import { ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { ComponentProps } from "react";
import { SessionDeviceMenu } from "./session-device-menu";
import { SessionWorkspaceControl } from "./session-workspace-control";

interface SessionChatWorkspaceHubProps
  extends ComponentProps<typeof SessionWorkspaceControl>,
    Pick<ComponentProps<typeof ChatWorkspaceHub>, "additions" | "deletions"> {}

// New sessions run on this device. Choosing another device arrives with remote commands (PS-827).
const thisDevice = { id: "this-device", name: "This device", current: true };

export const SessionChatWorkspaceHub = (props: SessionChatWorkspaceHubProps) => {
  const { additions, deletions, ...workspace } = props;
  const device = workspace.view.device
    ? { id: workspace.view.device.id, name: workspace.view.device.name }
    : thisDevice;
  return (
    <ChatWorkspaceHub
      workspaceControl={
        <HStack gap="2xs" minW="0">
          <SessionDeviceMenu
            devices={[device]}
            selectedDeviceId={device.id}
            isDisabled={Boolean(workspace.view.sessionId)}
          />
          <SessionWorkspaceControl {...workspace} />
        </HStack>
      }
      additions={additions}
      deletions={deletions}
    />
  );
};
