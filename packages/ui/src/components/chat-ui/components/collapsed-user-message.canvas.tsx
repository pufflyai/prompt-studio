import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const wrappedPrompt =
  "Please review the release checklist and explain each remaining risk. Include the current status, the responsible owner, the next action, and the validation evidence for every item. Keep the summary useful for someone who has not read the source code.";
const messages = (text: string): SessionMessage[] => [
  { id: "prompt", role: "user", parts: [{ type: "text", text }] },
  { id: "answer", role: "assistant", parts: [{ type: "text", text: "I will review the remaining risks." }] },
];
interface PreviewProps {
  text: string;
  narrow?: boolean;
  resizable?: boolean;
}
function Preview(props: PreviewProps) {
  const { text, narrow = false, resizable = false } = props;
  const [isNarrow, setNarrow] = useState(narrow);
  return (
    <Stack>
      {resizable ? <Button onClick={() => setNarrow(!isNarrow)}>Resize panel</Button> : null}
      <Box width={isNarrow ? "280px" : "960px"} maxWidth="full" height="520px" bg="bg" overflow="hidden">
        <ChatPanel
          messages={messages(text)}
          emptyStateTitle="No messages"
          emptyStateDescription="Send a message"
          chatInputPlaceholder="Type a message..."
        />
      </Box>
    </Stack>
  );
}
const meta: CanvasMeta = {
  title: "Patterns/Chat/Collapsed User Message",
};
export default meta;
type Story = CanvasVariant;
export const WrappedPrompt: Story = {
  id: "patterns-chat-collapsed-user-message--wrapped-prompt",
  render: () => <Preview text={wrappedPrompt} narrow />,
};
export const MarkdownHeadings: Story = {
  id: "patterns-chat-collapsed-user-message--markdown-headings",
  render: () => <Preview text={"# Release status\n# Remaining risks\n# Next actions"} />,
};
export const ResizeWrappedPrompt: Story = {
  id: "patterns-chat-collapsed-user-message--resize-wrapped-prompt",
  render: () => <Preview text={wrappedPrompt} resizable />,
};
export const ShortPrompt: Story = {
  id: "patterns-chat-collapsed-user-message--short-prompt",
  render: () => <Preview text="Review the release checklist." narrow />,
};
function UpdatedPrompt() {
  const [text, setText] = useState("Review the release checklist.");
  return (
    <Stack>
      <Button onClick={() => setText(wrappedPrompt)}>Load full prompt</Button>
      <Preview text={text} narrow />
    </Stack>
  );
}
export const UpdatedContent: Story = {
  id: "patterns-chat-collapsed-user-message--updated-content",
  render: () => <UpdatedPrompt />,
};
export const ThemePreview: Story = {
  id: "patterns-chat-collapsed-user-message--theme-preview",
  render: () => <Preview text={wrappedPrompt} narrow />,
};
