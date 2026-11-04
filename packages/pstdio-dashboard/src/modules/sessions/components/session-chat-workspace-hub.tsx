import { HStack } from "@chakra-ui/react";
import { ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { ComponentProps } from "react";
import type { useSessionDevice } from "../hooks/use-session-device";
import { SessionDeviceMenu } from "./session-device-menu";
import { SessionWorkspaceControl } from "./session-workspace-control";

interface SessionChatWorkspaceHubProps
  extends ComponentProps<typeof SessionWorkspaceControl>,
    Pick<ComponentProps<typeof ChatWorkspaceHub>, "additions" | "deletions"> {
  device: ReturnType<typeof useSessionDevice>;
}

export const SessionChatWorkspaceHub = (props: SessionChatWorkspaceHubProps) => {
  const { additions, deletions, device, ...workspace } = props;
  return (
    <ChatWorkspaceHub
      workspaceControl={
        <HStack gap="2xs" minW="0">
          <SessionDeviceMenu
            devices={device.devices}
            selectedDeviceId={device.selectedDeviceId}
            selectedDeviceName={device.name}
            onSelectDevice={device.setSelectedDeviceId}
            isDisabled={Boolean(workspace.view.sessionId)}
          />
          <SessionWorkspaceControl {...workspace} deviceId={device.deviceId} unavailable={device.unavailable} />
        </HStack>
      }
      additions={additions}
      deletions={deletions}
    />
  );
};
