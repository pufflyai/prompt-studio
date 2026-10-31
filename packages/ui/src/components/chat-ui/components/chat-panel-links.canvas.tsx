import { Box, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { RichMessage } from "@/components/rich-text/rich-message/rich-message";
import { type ChatLinkCandidate, parseChatLink } from "../links/chat-link";
import { ChatPanel } from "./chat-panel";

const workspaceHref = (candidate: ChatLinkCandidate) =>
  candidate.source === "missing.ts" || parseChatLink(candidate)?.kind === "external"
    ? null
    : `/projects/demo/workspace?document=${encodeURIComponent(candidate.source)}`;
const confirmWorkspaceFile = async (candidate: ChatLinkCandidate) => {
  const href = workspaceHref(candidate);
  return href ? { href } : null;
};
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
        resolveHref: workspaceHref,
        resolveResource: async (candidate) => {
          const href = workspaceHref(candidate);
          return href ? { href } : null;
        },
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
  const source = '[Source](src/app.ts "Original title") after README.md.';
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
  fullscreen: true,
  decorators: [
    (Story) => (
      <Box h="100vh">
        <Story />
      </Box>
    ),
  ],
} satisfies CanvasMeta<typeof LinkConversation>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const FileLinks: Story = {
  id: "chat-chatpanel-links--file-links",
};
export const StreamingLinks: Story = {
  id: "chat-chatpanel-links--streaming-links",
  args: { streaming: true },
};
export const ExternalReferences: Story = {
  id: "chat-chatpanel-links--external-references",
  render: () => (
    <RichMessage
      defaultState="Open {{link('https://example.com')}}."
      linkHandler={{ resolveHref: () => null, resolveResource: async () => null, open: () => {} }}
    />
  ),
};
export const ResourceBubbles: Story = {
  id: "chat-chatpanel-links--resource-bubbles",
  render: () => {
    const [opened, setOpened] = useState<string>();
    return (
      <>
        <RichMessage
          defaultState="Review tickets/T-1/ticket.md, [ticket](tickets/T-1/ticket.md), `tickets/T-1/ticket.md`, and {{link('tickets/T-1/ticket.md')}}. Read tickets/T-1/files/notes.md. [Website](https://example.com) stays a web link."
          linkHandler={{
            resolveHref: () => null,
            resolveResource: async (candidate) => ({
              label: candidate.source.endsWith("notes.md") ? "notes.md" : "T-1 Fix resource links",
              icon: candidate.source.endsWith("notes.md") ? "file-text" : "component",
              href: "/projects/demo/ticket/T-1",
            }),
            open: (candidate) => setOpened(candidate.source),
          }}
        />
        {opened ? <Text>{opened}</Text> : null}
      </>
    );
  },
};
const existingFiles = new Set(["src/app.ts", "README.md"]);
export const GuessedPaths: Story = {
  id: "chat-chatpanel-links--guessed-paths",
  render: () => (
    <RichMessage
      defaultState={
        "Local `main` matches `origin/main`. See github.com, **Node.js**, the U.S. market and Node 18.x. " +
        "Read `src/app.ts`, README.md and src/missing.ts, or {{link('src/app.ts')}}.\n\n" +
        "| Ref | File |\n| --- | --- |\n| `origin/main` | `src/app.ts` |"
      }
      linkHandler={{
        resolveHref: workspaceHref,
        resolveResource: async (candidate) =>
          existingFiles.has(candidate.source) ? { href: workspaceHref(candidate) } : null,
        open: () => {},
      }}
    />
  ),
};
export const StandaloneRichMessage: Story = {
  id: "chat-chatpanel-links--standalone-rich-message",
  render: () => (
    <RichMessage
      defaultState="[Source](src/app.ts:2) and `src/app.ts`."
      linkHandler={{ resolveHref: workspaceHref, resolveResource: confirmWorkspaceFile, open: () => {} }}
    />
  ),
};
export const ParenthesizedPaths: Story = {
  id: "chat-chatpanel-links--parenthesized-paths",
  render: () => {
    const [opened, setOpened] = useState<string>();
    return (
      <>
        <RichMessage
          defaultState="Read src/app/(dashboard)/page.ts and (src/app/[id]/page.ts)."
          linkHandler={{
            resolveHref: workspaceHref,
            resolveResource: confirmWorkspaceFile,
            open: (candidate) => setOpened(candidate.source),
          }}
        />
        <Text data-testid="opened-path">{opened}</Text>
      </>
    );
  },
};
export const EditableSource: Story = {
  id: "chat-chatpanel-links--editable-source",
  render: () => <EditableLinkMessage />,
};
