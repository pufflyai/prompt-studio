import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import * as Y from "yjs";
import { MarkdownEditor } from "./markdown-editor";

const initial = "# Shared document\n\nFirst paragraph.\n\nKeep __this spelling__ and {{token}}.";
const tableInitial = "| A | B |\n| --- | --- |\n| left | right |";
const selectEnd = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
};
const createPair = (source: string) => {
  const first = new Y.Doc();
  first.getText("content").insert(0, source);
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  return [first, second] as const;
};

const CollaborationScene = (props: { source?: string }) => {
  const { source = initial } = props;
  const [documents] = useState(() => createPair(source));
  const [connected, setConnected] = useState(true);
  const [sources, setSources] = useState([source, source]);
  const [lastChanges, setLastChanges] = useState(["", ""]);
  useEffect(() => {
    const render = () => setSources(documents.map((document) => document.getText("content").toString()));
    for (const document of documents) document.on("update", render);
    return () => {
      for (const document of documents) document.off("update", render);
    };
  }, [documents]);
  useEffect(() => {
    if (!connected) return;
    const [first, second] = documents;
    const forward = (update: Uint8Array, origin: unknown) => {
      if (origin !== "story-peer") Y.applyUpdate(second, update, "story-peer");
    };
    const backward = (update: Uint8Array, origin: unknown) => {
      if (origin !== "story-peer") Y.applyUpdate(first, update, "story-peer");
    };
    first.on("update", forward);
    second.on("update", backward);
    Y.applyUpdate(first, Y.encodeStateAsUpdate(second), "story-peer");
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first), "story-peer");
    return () => {
      first.off("update", forward);
      second.off("update", backward);
    };
  }, [documents, connected]);
  useEffect(
    () => () => {
      for (const document of documents) document.destroy();
    },
    [documents],
  );
  return (
    <Stack gap="md">
      <Button size="xs" alignSelf="start" onClick={() => setConnected(!connected)}>
        {connected ? "Disconnect" : "Reconnect"}
      </Button>
      {source === tableInitial ? (
        <Button
          size="xs"
          alignSelf="start"
          onClick={() => {
            const text = documents[1].getText("content");
            const index = text.toString().indexOf("left");
            if (index >= 0) text.insert(index, "REMOTE ");
          }}
        >
          Remote cell prefix
        </Button>
      ) : null}
      <Button
        size="xs"
        alignSelf="start"
        onClick={() => {
          const text = documents[1].getText("content");
          const previous = text.toString().includes("First paragraph.") ? "First" : "Remote";
          const index = text.toString().indexOf(`${previous} paragraph.`);
          if (index < 0) return;
          documents[1].transact(() => {
            text.delete(index, previous.length);
            text.insert(index, previous === "First" ? "Remote" : "First");
          });
        }}
      >
        Remote first paragraph
      </Button>
      <Button
        size="xs"
        alignSelf="start"
        onClick={() => {
          const text = documents[1].getText("content");
          text.insert(text.length, " (remote)");
        }}
      >
        Remote suffix
      </Button>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="md">
        {documents.map((document, index) => (
          <Stack key={document.guid} gap="sm" minW="0" data-testid={`device-${index}`}>
            <Text textStyle="label/M/medium">{index === 0 ? "Laptop" : "Desktop"}</Text>
            <Box minH="20rem" borderWidth="1px" borderColor="border.subtle">
              <MarkdownEditor
                defaultState={source}
                isEditable
                collaboration={{ document }}
                onChange={(value) =>
                  setLastChanges((current) => current.map((text, item) => (item === index ? value : text)))
                }
              />
            </Box>
            <Box as="pre" textStyle="mono/XS" whiteSpace="pre-wrap" data-testid="source">
              {sources[index]}
            </Box>
            <Box as="pre" textStyle="mono/XS" whiteSpace="pre-wrap" data-testid="last-local-change">
              {lastChanges[index]}
            </Box>
          </Stack>
        ))}
      </SimpleGrid>
    </Stack>
  );
};

const meta = {
  title: "Patterns/Editors/Markdown Editor/Collaboration",
  component: MarkdownEditor,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MarkdownEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SharedEditing: Story = {
  render: () => <CollaborationScene />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const laptop = within(canvas.getByTestId("device-0"));
    const desktop = within(canvas.getByTestId("device-1"));
    await userEvent.click(laptop.getByRole("textbox"));
    selectEnd(laptop.getByRole("textbox"));
    await userEvent.keyboard("!");
    await waitFor(() => expect(desktop.getByTestId("source").textContent).toBe(`${initial}!`));
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(desktop.getByRole("textbox"));
    selectEnd(desktop.getByRole("textbox"));
    await userEvent.keyboard("?");
    await expect(laptop.getByTestId("source").textContent).toBe(`${initial}!`);
    await userEvent.click(canvas.getByRole("button", { name: "Reconnect" }));
    await waitFor(() => expect(laptop.getByTestId("source").textContent).toBe(`${initial}!?`));
    await expect(desktop.getByRole("textbox")).toHaveTextContent("this spelling");
  },
};

export const SharedTableEditing: Story = {
  render: () => <CollaborationScene source={tableInitial} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const laptop = within(canvas.getByTestId("device-0"));
    await userEvent.click(laptop.getByRole("cell", { name: "left", exact: true }));
    const page = within(canvasElement.ownerDocument.body);
    const editor = await waitFor(() => {
      const popover = canvasElement.ownerDocument.querySelector<HTMLElement>("[data-table-cell-editor]")!;
      return within(popover).getByRole("textbox");
    });
    await userEvent.click(editor);
    selectEnd(editor);
    await userEvent.keyboard(" draft");
    await userEvent.click(canvas.getByRole("button", { name: "Remote cell prefix" }));
    await waitFor(() => expect(laptop.getByTestId("source")).toHaveTextContent("REMOTE left"));
    await expect(editor).toHaveTextContent("left draft");
    await userEvent.click(page.getByRole("button", { name: "Save cell", exact: true }));
    await waitFor(() => expect(laptop.getByTestId("source")).toHaveTextContent("REMOTE left draft"));
    await expect(laptop.getByRole("cell", { name: "REMOTE left draft", exact: true })).toBeVisible();
  },
};
