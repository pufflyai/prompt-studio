import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { AlertMessage } from "@/components/primitives/alert";
import { RichMessage } from "@/components/rich-text/rich-message/rich-message";
import { parseChatLink } from "../links/chat-link";
import { ChatPanel } from "./chat-panel";

const LinkConversation = (props: { streaming?: boolean }) => {
  const { streaming = false } = props;
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <ChatPanel
      streaming={streaming}
      messages={[
        {
          id: "user",
          role: "user",
          parts: [
            { type: "text", text: "Review [README](README.md), `src/app.ts:12`, and {{link('$PROJECT/src/app.ts')}}." },
          ],
        },
        {
          id: "assistant",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "[Source](src/app.ts:12:4)\n\n| File | Review |\n| --- | --- |\n| [Draft](.pstdio/tickets/PS-105/ticket.md) | `src/app.ts` |\n\n[Missing file](missing.ts) and [Website](https://example.com).\n\n`src/deeply/nested/features/conversations/document-navigation/long-file-name.ts`\n\n```ts\nconst path = 'src/app.ts';\n```",
            },
            { type: "reasoning", text: "Inspect `src/app.ts` before changing it." },
            {
              type: "tool",
              tool: "read",
              status: "completed",
              state: { input: { file_path: "src/app.ts" }, output: "[Tool source](src/app.ts:2)" },
            },
          ],
        },
      ]}
      linkHandler={{
        resolveHref: (candidate) =>
          candidate.source === "missing.ts" || parseChatLink(candidate)?.kind === "external"
            ? null
            : `/projects/demo/workspace?document=${encodeURIComponent(candidate.source)}`,
        describe: (candidate) => `Workspace demo: ${candidate.source}`,
        open: (candidate) => setOpened(candidate.source),
      }}
      conversationNotices={
        opened ? (
          <AlertMessage
            status={opened === "missing.ts" ? "error" : "info"}
            title={opened === "missing.ts" ? "Workspace file not found" : "Opened link"}
            onClose={() => setOpened(null)}
          >
            {opened}
          </AlertMessage>
        ) : undefined
      }
      emptyStateTitle="Conversation"
      emptyStateDescription="Inspect workspace links"
      chatInputPlaceholder="Reply…"
    />
  );
};

const EditableLinkMessage = () => {
  const source = '[Source](src/app.ts "Original title") after.';
  const [markdown, setMarkdown] = useState(source);
  return (
    <>
      <RichMessage
        defaultState={source}
        isEditable
        onChange={setMarkdown}
        linkHandler={{
          resolveHref: () => "/projects/demo/workspace?document=src%2Fapp.ts",
          describe: () => "Workspace demo: src/app.ts",
          open: () => {},
        }}
      />
      <Text data-testid="exported-markdown">{markdown}</Text>
    </>
  );
};
const meta = {
  title: "Chat/ChatPanel/Links",
  component: LinkConversation,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box h="100vh">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof LinkConversation>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FileLinks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const source = await canvas.findByRole("link", { name: "Source" });
    source.focus();
    await expect(source).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByText("Opened link")).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Missing file" }));
    await expect(await canvas.findByText("Workspace file not found")).toBeVisible();
  },
};
export const StreamingLinks: Story = { args: { streaming: true } };
export const StandaloneRichMessage: Story = {
  render: () => (
    <RichMessage
      defaultState="[Source](src/app.ts:2) and `src/app.ts`."
      linkHandler={{
        resolveHref: (candidate) => `/projects/demo/workspace?document=${encodeURIComponent(candidate.source)}`,
        open: () => {},
      }}
    />
  ),
};
export const EditableSource: Story = {
  render: () => <EditableLinkMessage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox");
    await userEvent.click(editor);
    await userEvent.type(editor, " updated", { skipClick: true });
    await expect(canvas.getByTestId("exported-markdown")).toHaveTextContent('"Original title"');
    await expect(canvas.getByTestId("exported-markdown")).toHaveTextContent("updated");
    await expect(canvas.getByTestId("exported-markdown")).not.toHaveTextContent("Workspace demo");
  },
};
