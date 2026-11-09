import { Button, Stack } from "@chakra-ui/react";
import type { ChatRendererSnapshot } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { NativeChatWorkspace } from "../../react/renderers/chat/native-chat-workspace";

export default { title: "Proposals/PS-163 Session workspace visibility" };

export const WorkspaceAvailability = () => {
  const [enabled, setEnabled] = useState(false);
  const conversation: ChatRendererSnapshot = {
    workspace: {
      controlId: "workspace",
      deviceControlId: "device",
      ...(enabled ? { additions: 12, deletions: 3, openResourceId: "workspace" } : {}),
    },
    controls: [
      {
        id: "device",
        type: "selection",
        name: "Device",
        defaultValue: "laptop",
        readOnly: true,
        options: [{ id: "laptop", name: "Research laptop" }],
      },
      ...(enabled
        ? [
            {
              id: "workspace",
              type: "selection" as const,
              name: "Workspace",
              defaultValue: "workspace",
              readOnly: true,
              options: [{ id: "workspace", name: "feature/session-header" }],
            },
          ]
        : []),
    ],
  };
  return (
    <Stack>
      <Button onClick={() => setEnabled(!enabled)}>{enabled ? "Remove Workspaces" : "Install Workspaces"}</Button>
      <NativeChatWorkspace
        conversation={conversation}
        draft={{ text: "", attachments: [], values: {} }}
        run={async () => ({})}
        changeValues={() => {}}
      />
    </Stack>
  );
};
