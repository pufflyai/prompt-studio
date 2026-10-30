import { Box, Theme } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { canvasVsCodeThemes } from "../../../../.canvas/vscode-themes";
import { defaultThemePreferences, type ThemePreferenceOption } from "../../../utils/apply-theme-preference";
import { ChatPanel } from "./chat-panel";

const themes: ThemePreferenceOption[] = [...defaultThemePreferences, ...canvasVsCodeThemes];
const meta = {
  title: "Patterns/Chat/Message Surfaces",
  component: ChatPanel,
  parameters: { layout: "padded" },
  args: {
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Summarize the remaining release risks." }] },
      {
        id: "assistant",
        role: "assistant",
        parts: [{ type: "text", text: "Two risks remain: the migration backup and the Windows installer size." }],
      },
    ],
    emptyStateTitle: "No messages",
    emptyStateDescription: "Start a conversation.",
    chatInputPlaceholder: "Reply...",
  },
  render: (args, context) => {
    const theme = themes.find((theme) => theme.id === context.globals.theme) ?? themes[0]!;
    const tokens = Object.fromEntries(
      Object.entries(theme.tokens ?? {}).map(([path, value]) => [`--chakra-${path.replaceAll(".", "-")}`, value]),
    );
    return (
      <Theme appearance={theme.mode} css={tokens}>
        <Box maxW="chat-content" h="md">
          <ChatPanel {...args} />
        </Box>
      </Theme>
    );
  },
} satisfies CanvasMeta<typeof ChatPanel>;

export default meta;
type Story = CanvasVariant<typeof meta>;

export const Light: Story = { id: "patterns-chat-message-surfaces--light", globals: { theme: "pstdio-light" } };
export const Dark: Story = { id: "patterns-chat-message-surfaces--dark", globals: { theme: "pstdio-dark" } };
export const VsCodeMonokai: Story = {
  id: "patterns-chat-message-surfaces--vs-code-monokai",
  globals: { theme: "vscode-monokai" },
};
export const VsCodeDracula: Story = {
  id: "patterns-chat-message-surfaces--vs-code-dracula",
  globals: { theme: "vscode-dracula" },
};
export const VsCodeSolarizedLight: Story = {
  id: "patterns-chat-message-surfaces--vs-code-solarized-light",
  globals: { theme: "vscode-solarized-light" },
};
