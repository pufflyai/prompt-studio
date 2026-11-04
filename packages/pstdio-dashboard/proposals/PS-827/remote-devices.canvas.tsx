import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { ChatPanel, ChatWorkspaceHub, type SessionMessage } from "@pstdio/ui/chat-ui";
import { useState } from "react";
import { SessionDeviceMenu } from "../../src/modules/sessions/components/session-device-menu";
import { SessionWorkspaceMenu } from "../../src/modules/sessions/components/session-workspace-menu";
import type { DashboardWorkspaceOption } from "../../src/shared/workspaces/workspace-options";
import { SessionPersonalDevice } from "./session-personal-device";

const devices = [
  { id: "this-device", name: "This device", current: true },
  { id: "laptop", name: "Laptop" },
];
const workspace: DashboardWorkspaceOption = {
  id: "workspace",
  title: "feature/panel-colors",
  shorthand: "WS-1",
  branch: "feature/panel-colors",
  type: "worktree",
  isDefault: false,
  executionKind: "local",
  providerState: "ready",
  supportsFiles: true,
  supportsDiff: true,
  supportsDelete: true,
  workspacePath: "/workspace/project",
  updatedAt: "2026-01-01T00:00:00Z",
};

const RemoteSession = (props: { offline?: boolean; queued?: boolean; draft?: boolean }) => {
  const { offline = false, queued = false, draft = false } = props;
  const [deviceId, setDeviceId] = useState(draft ? "this-device" : "laptop");
  const [started, setStarted] = useState(!draft);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(queued);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [messages, setMessages] = useState<SessionMessage[]>(
    draft
      ? []
      : [
          {
            id: "assistant",
            role: "assistant",
            parts: [{ type: "text", text: "The color changes are ready. I can run the checks next." }],
          },
        ],
  );
  const [queue, setQueue] = useState(
    queued ? [{ id: "queued-1", prompt: "Then update the changelog.", position: 1 }] : [],
  );
  const name = devices.find((device) => device.id === deviceId)?.name ?? "Laptop";
  return (
    <Stack h="2xl" w="full" maxW="3xl" gap="0" bg="bg" overflow="hidden">
      <Box flex="1" minH="0">
        <ChatPanel
          messages={messages}
          streaming={running && !offline}
          emptyStateTitle="Start a conversation"
          emptyStateDescription={`Run the session on ${name}.`}
          chatInputPlaceholder="Reply to the agent..."
          chatInputDefaultValue={text}
          onChatInputChange={setText}
          onSubmitMessage={(prompt) => {
            setStarted(true);
            if (running)
              setQueue((items) => [...items, { id: `queued-${items.length + 1}`, prompt, position: items.length + 1 }]);
            else
              setMessages((items) => [
                ...items,
                { id: `message-${items.length}`, role: "user", parts: [{ type: "text", text: prompt }] },
              ]);
            setText("");
          }}
          onInterrupt={() => setRunning(false)}
          queuedFollowUps={queue}
          readOnlyQueue={offline}
          composerFallback={offline ? <SessionPersonalDevice name={name} /> : undefined}
          workspaceHub={
            <ChatWorkspaceHub
              additions={12}
              deletions={3}
              workspaceControl={
                <HStack gap="2xs" minW="0">
                  <SessionDeviceMenu
                    devices={devices}
                    selectedDeviceId={deviceId}
                    onSelectDevice={setDeviceId}
                    isDisabled={started}
                  />
                  <SessionWorkspaceMenu
                    workspaces={[workspace]}
                    selectedWorkspaceId={workspace.id}
                    selectedWorkspaceLabel={workspace.title}
                    onSelectWorkspace={() => {}}
                    onOpenWorkspace={offline || !started ? undefined : () => setWorkspaceOpen(true)}
                    isDisabled={started}
                  />
                </HStack>
              }
            />
          }
        />
      </Box>
      {workspaceOpen ? (
        <Text p="sm" textStyle="label/S/regular">
          Workspace files and diff open from {name} while it is online.
        </Text>
      ) : null}
    </Stack>
  );
};

export default {
  title: "Proposals/PS-827 Remote devices",
  description:
    "Synthetic interactions only. Online sessions use the normal composer; existing sessions stay on their device. Offline sessions retain readable history and have no workspace link or command queue.",
} satisfies CanvasMeta;

export const OnlineConversation = () => <RemoteSession />;
export const QueuedOnLaptop = () => <RemoteSession queued />;
export const OfflineLaptop = () => <RemoteSession offline queued />;
export const NewSessionDevicePicker = () => <RemoteSession draft />;
