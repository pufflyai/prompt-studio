import { Box, Button, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { $getRoot, $getSelection, $isRangeSelection, getNearestEditorFromDOMNode } from "lexical";
import { useEffect, useState } from "react";

import * as Y from "yjs";
import { MarkdownEditor } from "./markdown-editor";

const initial = "# Shared document\n\nFirst paragraph.\n\nKeep __this spelling__ and {{token}}.";
const tableInitial = "| A | B |\n| --- | --- |\n| left | right |";
const createPair = (source: string) => {
  const first = new Y.Doc();
  first.getText("content").insert(0, source);
  const second = new Y.Doc();
  Y.applyUpdate(second, Y.encodeStateAsUpdate(first));
  return [first, second] as const;
};

const CollaborationScene = (props: {
  source?: string;
  commitOrder?: "remote-first" | "local-first" | "both-local-first";
}) => {
  const { source = initial, commitOrder } = props;
  const [documents] = useState(() => createPair(source));
  const [connected, setConnected] = useState(true);
  const [sources, setSources] = useState([source, source]);
  const [lastChanges, setLastChanges] = useState(["", ""]);
  const [selections, setSelections] = useState<(number | null)[]>([null, null]);
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
      {commitOrder ? (
        <Button
          size="xs"
          alignSelf="start"
          onClick={(event) => {
            const roots =
              event.currentTarget.parentElement!.querySelectorAll<HTMLElement>('[data-lexical-editor="true"]');
            const local = (index = 0, value = " LOCAL") =>
              getNearestEditorFromDOMNode(roots[index]!)!.update(() => {
                $getRoot().selectEnd();
                const range = $getSelection();
                if ($isRangeSelection(range)) range.insertText(value);
              });
            const remote = () => documents[1].getText("content").insert(0, "REMOTE ");
            if (commitOrder === "both-local-first") {
              local(0, " LOCAL-A");
              local(1, " LOCAL-B");
              remote();
            } else if (commitOrder === "remote-first") {
              remote();
              local();
            } else {
              local();
              remote();
            }
          }}
        >
          Commit {commitOrder} edits
        </Button>
      ) : null}
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
                collaboration={{
                  document,
                  onSelectionChange: (selection) => {
                    const position = selection
                      ? Y.createAbsolutePositionFromRelativePosition(
                          Y.decodeRelativePosition(selection.focus),
                          document,
                        )
                      : null;
                    setSelections((current) =>
                      current.map((value, item) => (item === index ? (position?.index ?? null) : value)),
                    );
                  },
                }}
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
            <Box as="output" data-testid="selection-offset">
              {selections[index]}
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
} satisfies CanvasMeta<typeof MarkdownEditor>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SharedEditing: Story = {
  id: "patterns-editors-markdown-editor-collaboration--shared-editing",
  render: () => <CollaborationScene />,
};

export const EmptyNote: Story = {
  id: "patterns-editors-markdown-editor-collaboration--empty-note",
  render: () => <CollaborationScene source={'---\ntitle: "New note"\n---'} />,
};

export const SharedTableEditing: Story = {
  id: "patterns-editors-markdown-editor-collaboration--shared-table-editing",
  render: () => <CollaborationScene source={tableInitial} />,
};

export const SameTickRemoteFirst: Story = {
  id: "patterns-editors-markdown-editor-collaboration--same-tick-remote-first",

  render: () => <CollaborationScene source="Start" commitOrder="remote-first" />,
};
export const SameTickLocalFirst: Story = {
  id: "patterns-editors-markdown-editor-collaboration--same-tick-local-first",

  render: () => <CollaborationScene source="Start" commitOrder="local-first" />,
};

export const SameTickBothEditors: Story = {
  id: "patterns-editors-markdown-editor-collaboration--same-tick-both-editors",

  render: () => <CollaborationScene source="Start" commitOrder="both-local-first" />,
};
