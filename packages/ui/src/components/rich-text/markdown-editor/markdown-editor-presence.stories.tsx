import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import * as Y from "yjs";
import { DocumentParticipants } from "../../primitives/document-participants";
import { MarkdownEditor } from "./markdown-editor";
import type { MarkdownCollaboration } from "./plugins/markdown-collaboration-plugin";

const body = "First **shared** paragraph with a flag 🇸🇪.\n\nSecond paragraph stays in place.";
const frontmatter = "---\ntitle: Shared plan\n---\n\n";
const participant = { id: "alex-laptop", label: "Alex", color: "blue" as const };

const PresenceScene = (props: { long?: boolean; narrow?: boolean }) => {
  const { long = false, narrow = false } = props;
  const [document] = useState(() => {
    const document = new Y.Doc();
    document.getText("content").insert(0, frontmatter + body + (long ? "\n\nAnother paragraph.".repeat(30) : ""));
    return document;
  });
  const [connected, setConnected] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [selection] = useState(() => {
    const text = document.getText("content");
    return {
      anchor: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, frontmatter.length + 8)),
      focus: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(text, frontmatter.length + 24)),
    };
  });
  useEffect(() => () => document.destroy(), [document]);
  const participants: MarkdownCollaboration["participants"] = connected
    ? [{ ...participant, selection: collapsed ? { anchor: selection.focus, focus: selection.focus } : selection }]
    : [];
  return (
    <Stack gap="md" maxW={narrow ? "2xs" : "full"}>
      <Button alignSelf="start" onClick={() => setConnected(!connected)}>
        {connected ? "Disconnect" : "Reconnect"}
      </Button>
      <Button
        alignSelf="start"
        onClick={() => document.getText("content").insert(frontmatter.length, "Peer prefix.\n\n")}
      >
        Insert before selection
      </Button>
      <Button alignSelf="start" onClick={() => setCollapsed(!collapsed)}>
        Toggle selection
      </Button>
      <Box h="24rem" minH="0" borderWidth="1px" borderColor="border.subtle" data-testid="document-frame">
        <Stack gap="0" h="full" minH="0">
          <DocumentParticipants participants={participants} label="Other editors" />
          <Box flex="1" minH="0">
            <MarkdownEditor defaultState="" isEditable collaboration={{ document, participants }} />
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
};

const meta = {
  title: "Patterns/Editors/Markdown Editor/Presence",
  component: MarkdownEditor,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MarkdownEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RemoteSelection: Story = {
  render: () => <PresenceScene />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector("[data-remote-caret]")).not.toBeNull());
    await expect(canvasElement.querySelector("[data-remote-selection]")).not.toBeNull();
    await expect(canvas.getByRole("textbox")).not.toHaveTextContent("Alex");
    await expect(canvas.getByRole("textbox")).not.toHaveTextContent("title: Shared plan");
    await userEvent.click(canvas.getByRole("button", { name: "Insert before selection" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-remote-caret]")).not.toBeNull());
    await expect(canvas.getByRole("textbox")).toHaveTextContent("Peer prefix.");
    await userEvent.click(canvas.getByRole("button", { name: "Toggle selection" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-remote-selection]")).toBeNull());
    await expect(canvasElement.querySelector("[data-remote-caret]")).not.toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(canvasElement.querySelector("[data-remote-caret]")).toBeNull());
    await expect(canvas.queryByRole("list", { name: "Other editors" })).not.toBeInTheDocument();
  },
};
export const Narrow: Story = { render: () => <PresenceScene narrow /> };
export const Scrolling: Story = { render: () => <PresenceScene long /> };
