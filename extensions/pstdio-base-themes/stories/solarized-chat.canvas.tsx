import { Box, Button, HStack, IconButton, Stack, Tag, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ListRow, type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";

const statuses: SessionCompletionStatus[] = [
  "in_progress",
  "queued",
  "awaiting_input",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
];
interface SolarizedChatProps {
  surface?: "bg" | "bg.panel";
  width?: "chat-content" | "80";
}
function SolarizedChat(props: SolarizedChatProps) {
  const { surface = "bg", width = "chat-content" } = props;
  return (
    <Stack p="md" maxW={width} gap="md" bg={surface} color="fg">
      <HStack flexWrap="wrap" data-testid="session-states">
        {statuses.map((status) => (
          <HStack key={status} gap="2xs">
            <SessionIndicator status={status} ariaLabel={status} />
            <Text>{status}</Text>
          </HStack>
        ))}
      </HStack>
      <Tag.Root>
        <Tag.Label>Workspace tag</Tag.Label>
      </Tag.Root>
      <HStack>
        <Button variant="ghost" aria-pressed>
          Selected
        </Button>
        <Button variant="ghost">Default</Button>
      </HStack>
      <ListRow label="Selected workspace" description="Workspace description" isSelected data-testid="selected-row" />
      <Box h="lg">
        <ChatPanel
          messages={[{ id: "user", role: "user", parts: [{ type: "text", text: "Check the workspace." }] }]}
          streaming
          emptyStateTitle="No messages"
          emptyStateDescription="Start a conversation."
          chatInputPlaceholder="Reply..."
          workspaceHub={
            <ChatWorkspaceHub
              additions={12}
              deletions={3}
              workspaceControl={
                <Button size="xs" variant="ghost">
                  main
                </Button>
              }
              action={
                <IconButton size="xs" variant="ghost" aria-label="Open workspace">
                  ↗
                </IconButton>
              }
            />
          }
        />
      </Box>
    </Stack>
  );
}
const meta = {
  title: "Themes/Solarized chat",
  fullscreen: true,
  component: SolarizedChat,
} satisfies CanvasMeta<typeof SolarizedChat>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Dark: Story = {
  id: "themes-solarized-chat--dark",
};
export const Light: Story = {
  id: "themes-solarized-chat--light",
};
export const DarkSidePanel: Story = {
  id: "themes-solarized-chat--dark-side-panel",
  args: { surface: "bg.panel", width: "80" },
};
export const LightSidePanel: Story = {
  id: "themes-solarized-chat--light-side-panel",
  args: { surface: "bg.panel", width: "80" },
};
