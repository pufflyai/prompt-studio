import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
    await expect(source.querySelector("svg.lucide-file-code")).not.toBeNull();
    source.focus();
    await expect(source).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByText("Opened link")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Missing file" }));
    await expect(await canvas.findByText("Workspace file not found")).toBeVisible();
  },
};
export const StreamingLinks: Story = { args: { streaming: true } };
export const ExternalReferences: Story = {
  render: () => (
    <RichMessage
      defaultState="Open {{link('https://example.com')}}."
      linkHandler={{ resolveHref: () => null, resolveResource: async () => null, open: () => {} }}
    />
  ),
  play: async ({ canvasElement }) => {
    const reference = await within(canvasElement).findByRole("link", { name: "example.com" });
    await expect(reference).toHaveAttribute("href", "https://example.com");
    await expect(reference).toHaveAttribute("target", "_blank");
    await expect(reference).toHaveAttribute("rel", "noopener noreferrer");
    await expect(reference.querySelector('[data-scope="tooltip"]')).toBeNull();
    reference.focus();
    await expect(reference).toHaveFocus();
  },
};
export const ResourceBubbles: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const links = await canvas.findAllByRole("link", { name: "T-1 Fix resource links" });
    await expect(links).toHaveLength(4);
    for (const link of links) {
      await expect(link.querySelector("svg.lucide-component")).not.toBeNull();
      await expect(link.querySelector('[data-scope="tooltip"]')).toBeNull();
      await expect(link.closest('[data-scope="tooltip"]')).toBeNull();
    }
    const document = await canvas.findByRole("link", { name: "notes.md" });
    await expect(document.querySelector("svg.lucide-file-text")).not.toBeNull();
    await userEvent.hover(links[0]!);
    await expect(getComputedStyle(links[0]!).textDecorationLine).toBe("none");
    links[0]!.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByText("tickets/T-1/ticket.md")).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Website" })).toHaveAttribute("href", "https://example.com");
  },
};
const existingFiles = new Set(["src/app.ts", "README.md"]);

export const GuessedPaths: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findAllByRole("link", { name: "src/app.ts", exact: true })).toHaveLength(2);
    await expect(await canvas.findByRole("link", { name: "README.md", exact: true })).toBeVisible();
    await expect(await canvas.findByRole("link", { name: "app.ts", exact: true })).toBeVisible();
    const table = canvasElement.querySelector("table")!;
    await expect(await within(table).findByRole("link", { name: "src/app.ts", exact: true })).toBeVisible();
    await expect(within(table).queryByRole("link", { name: "origin/main", exact: true })).toBeNull();
    for (const text of ["main", "origin/main", "github.com", "Node.js", "U.S", "18.x", "src/missing.ts"])
      await expect(canvas.queryByRole("link", { name: text, exact: true })).toBeNull();
    await expect(canvas.getAllByText("origin/main")[0]!.closest("code")).not.toBeNull();
    await expect(canvas.getByText("Node.js").closest("strong")).not.toBeNull();

    const message = canvasElement.querySelector('[data-rich-message="true"] [contenteditable]')!;
    const selection = window.getSelection()!;
    selection.selectAllChildren(message);
    let html = "";
    const readCopy = (event: ClipboardEvent) => {
      html = event.clipboardData?.getData("text/html") ?? "";
    };
    window.addEventListener("copy", readCopy, { once: true });
    document.execCommand("copy");
    selection.removeAllRanges();
    for (const text of ["origin/main", "<code>src/app.ts</code>", "README.md", "<strong>Node.js</strong>"])
      await expect(html).toContain(text);
    await expect(html).toContain("{{link('src/app.ts')}}");
  },
};
export const StandaloneRichMessage: Story = {
  render: () => (
    <RichMessage
      defaultState="[Source](src/app.ts:2) and `src/app.ts`."
      linkHandler={{ resolveHref: workspaceHref, resolveResource: confirmWorkspaceFile, open: () => {} }}
    />
  ),
};
export const ParenthesizedPaths: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const path = "src/app/(dashboard)/page.ts";
    const link = await canvas.findByRole("link", { name: path, exact: true });
    await expect(link).toHaveAttribute("href", `/projects/demo/workspace?document=${encodeURIComponent(path)}`);
    await userEvent.click(link);
    await expect(canvas.getByTestId("opened-path")).toHaveTextContent(path);
    await expect(canvas.getByRole("link", { name: "src/app/[id]/page.ts", exact: true })).toBeVisible();
    await expect(canvas.queryByRole("link", { name: "/page.ts", exact: true })).toBeNull();
  },
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
    await expect(canvas.getByTestId("exported-markdown")).toHaveTextContent("README.md");
    await expect(canvas.getByTestId("exported-markdown")).not.toHaveTextContent("Workspace demo");
  },
};
