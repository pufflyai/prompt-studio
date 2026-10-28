import { Box, Button, HStack, IconButton, Stack, Tag, Text } from "@chakra-ui/react";
import { ListRow, type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { contrastRatio } from "./contrast";

const statuses: SessionCompletionStatus[] = [
  "in_progress",
  "queued",
  "awaiting_input",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
];
function SolarizedChat() {
  return (
    <Stack p="md" maxW="chat-content" gap="md" bg="bg" color="fg">
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
  tags: ["solarized-chat"],
  component: SolarizedChat,
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.documentElement).toHaveAttribute("data-theme", globals.theme),
    );
    const workspace = canvasElement.querySelector(".ps-chat-composer__workspace")!;
    const tag = canvas.getByText("Workspace tag").closest(".chakra-tag__root")!;
    const userText = await canvas.findByText("Check the workspace.");
    await waitFor(() => expect(userText).toBeVisible());
    await waitFor(async () => {
      const background = getComputedStyle(canvasElement.firstElementChild!).backgroundColor;
      await expect(getComputedStyle(tag).backgroundColor).toBe(getComputedStyle(workspace).backgroundColor);
      const userSurface = getComputedStyle(userText.closest(".ai-message__content")!).backgroundColor;
      await expect(userSurface).not.toBe(background);
      await expect(contrastRatio(getComputedStyle(userText).color, userSurface)).toBeGreaterThanOrEqual(4.5);
      await expect(getComputedStyle(workspace.parentElement!).paddingTop).toBe("0px");
      for (const status of statuses) {
        const indicator = canvas.getByLabelText(status);
        await expect(contrastRatio(getComputedStyle(indicator).color, background)).toBeGreaterThanOrEqual(4.5);
      }
      const row = canvas.getByTestId("selected-row");
      const description = canvas.getByText("Workspace description");
      await expect(
        contrastRatio(getComputedStyle(description).color, getComputedStyle(row).backgroundColor),
      ).toBeGreaterThanOrEqual(4.5);
      const selected = getComputedStyle(canvas.getByRole("button", { name: "Selected" }));
      await expect(contrastRatio(selected.color, selected.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
  },
} satisfies Meta<typeof SolarizedChat>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Dark: Story = { globals: { theme: "solarized-dark" } };
export const Light: Story = { globals: { theme: "solarized-light" } };
