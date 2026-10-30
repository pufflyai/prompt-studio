import { Box, Theme } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ComponentProps } from "react";
import { canvasVsCodeThemes } from "../../../theme/custom/vscode-theme.canvas-fixture";
import { defaultThemePreferences, type ThemePreferenceOption } from "../../../utils/apply-theme-preference";
import { ChatPanel } from "./chat-panel";

const themes: ThemePreferenceOption[] = [...defaultThemePreferences, ...canvasVsCodeThemes];
// Each frame pins one theme, so the surfaces can be compared side by side.
const inTheme = (id: string) => (args: ComponentProps<typeof ChatPanel>) => {
  const theme = themes.find((theme) => theme.id === id) ?? themes[0]!;
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
};
const meta = {
  title: "Patterns/Chat/Message Surfaces",
  component: ChatPanel,
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
} satisfies CanvasMeta<typeof ChatPanel>;

export default meta;
type Story = CanvasVariant<typeof meta>;

export const Light: Story = { id: "patterns-chat-message-surfaces--light", render: inTheme("pstdio-light") };
export const Dark: Story = { id: "patterns-chat-message-surfaces--dark", render: inTheme("pstdio-dark") };
export const VsCodeMonokai: Story = {
  id: "patterns-chat-message-surfaces--vs-code-monokai",
  render: inTheme("vscode-monokai"),
};
export const VsCodeDracula: Story = {
  id: "patterns-chat-message-surfaces--vs-code-dracula",
  render: inTheme("vscode-dracula"),
};
export const VsCodeSolarizedLight: Story = {
  id: "patterns-chat-message-surfaces--vs-code-solarized-light",
  render: inTheme("vscode-solarized-light"),
};
