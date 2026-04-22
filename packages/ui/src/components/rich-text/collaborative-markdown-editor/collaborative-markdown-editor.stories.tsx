import "../theme/rich-text-theme.css";

import { Box, Flex, Heading, VStack } from "@chakra-ui/react";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { Provider } from "@lexical/yjs";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import * as Y from "yjs";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme } from "../shared/editor-config";
import { CodeBlockActionsPlugin } from "../shared/plugins/CodePlugin/CodeBlockActionsPlugin";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { FloatingTextFormatToolbarPlugin } from "../shared/plugins/FloatingTextFormatToolbarPlugin";
import { AwarenessCursorsCSS } from "./awareness-cursors";
import { CollaborativeMarkdownEditor } from "./collaborative-markdown-editor";

// --- In-memory provider for self-contained demos (no WS server needed) ---

type Listener = (...args: unknown[]) => void;

class InMemoryProvider {
  awareness: Awareness;
  private cbs: Record<string, Set<Listener>> = {};

  constructor(doc: Y.Doc) {
    this.awareness = new Awareness(doc);
  }

  connect() {
    queueMicrotask(() => {
      this.emit("sync", true);
      this.emit("status", { status: "connected" });
    });
  }

  disconnect() {}

  on(type: string, cb: Listener) {
    if (!this.cbs[type]) this.cbs[type] = new Set();
    this.cbs[type].add(cb);
  }

  off(type: string, cb: Listener) {
    this.cbs[type]?.delete(cb);
  }

  private emit(type: string, ...args: unknown[]) {
    for (const cb of this.cbs[type] ?? []) cb(...args);
  }
}

/** Bridge Y.Doc updates between two docs so edits in one appear in the other. */
function bridgeDocs(docA: Y.Doc, docB: Y.Doc) {
  let syncing = false;

  docA.on("update", (update: Uint8Array) => {
    if (syncing) return;
    syncing = true;
    Y.applyUpdate(docB, update);
    syncing = false;
  });

  docB.on("update", (update: Uint8Array) => {
    if (syncing) return;
    syncing = true;
    Y.applyUpdate(docA, update);
    syncing = false;
  });
}

/** Bridge awareness so cursors from one editor show in the other. */
function bridgeAwareness(a: Awareness, b: Awareness) {
  a.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const update = encodeAwarenessUpdate(a, [...added, ...updated, ...removed]);
    applyAwarenessUpdate(b, update, a);
  });

  b.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const update = encodeAwarenessUpdate(b, [...added, ...updated, ...removed]);
    applyAwarenessUpdate(a, update, b);
  });
}

// --- Editor pane (raw Lexical + CollaborationPlugin, no WebSocket) ---

interface EditorPaneProps {
  label: string;
  roomId: string;
  userName: string;
  userColor: string;
  provider: InMemoryProvider;
  doc: Y.Doc;
}

function EditorPane({ label, roomId, userName, userColor, provider, doc }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [toolbarAnchor, setToolbarAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarAnchor(containerRef.current);
  }, []);

  const initialConfig = {
    namespace: `COLLAB_${label}`,
    nodes: editorNodes,
    editorState: null,
    onError: (error: Error) => console.error(error),
    editable: true,
    theme: editorTheme,
  };

  const providerFactory = (_id: string, yjsDocMap: Map<string, Y.Doc>) => {
    yjsDocMap.set(_id, doc);
    return provider as unknown as Provider;
  };

  return (
    <VStack align="stretch" flex="1" minW="0">
      <Heading size="sm" px="2" py="1" borderBottom="1px solid" borderColor="border">
        <Box as="span" display="inline-block" w="10px" h="10px" borderRadius="full" bg={userColor} mr="2" />
        {label}
      </Heading>

      <Flex
        ref={containerRef}
        className="rich-text"
        flex="1"
        direction="column"
        overflow="hidden"
        position="relative"
        minH="300px"
      >
        <LexicalComposer initialConfig={initialConfig}>
          <LexicalCollaboration>
            <CollaborationPlugin
              id={roomId}
              providerFactory={providerFactory}
              shouldBootstrap={false}
              username={userName}
              cursorColor={userColor}
            />
            <LinkPlugin />
            <ListPlugin />
            <HorizontalRulePlugin />
            <CodeHighlightingPlugin />
            <ImportCodeBlocksPlugin />
            <CodeBlockActionsPlugin anchorElem={toolbarAnchor} />
            <EquationPlugin />
            <RichTextPlugin
              contentEditable={<ContentEditable fullWidth />}
              placeholder={
                <Box position="absolute" top="0" color="fg.muted" pointerEvents="none" userSelect="none">
                  Type here...
                </Box>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            {toolbarAnchor ? <FloatingTextFormatToolbarPlugin anchorElem={toolbarAnchor} /> : null}
          </LexicalCollaboration>
        </LexicalComposer>
      </Flex>
    </VStack>
  );
}

// --- Split-view story: two editors syncing via in-memory Yjs ---

function SplitViewDemo() {
  const roomId = "demo-room";

  const { docA, docB, providerA, providerB } = useMemo(() => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    bridgeDocs(docA, docB);

    const providerA = new InMemoryProvider(docA);
    const providerB = new InMemoryProvider(docB);

    bridgeAwareness(providerA.awareness, providerB.awareness);

    return { docA, docB, providerA, providerB };
  }, []);

  return (
    <Flex gap="4" h="500px">
      <AwarenessCursorsCSS />

      <EditorPane label="Alice" roomId={roomId} userName="Alice" userColor="#30bced" provider={providerA} doc={docA} />

      <EditorPane label="Bob" roomId={roomId} userName="Bob" userColor="#e06c75" provider={providerB} doc={docB} />
    </Flex>
  );
}

// --- Stories ---

const meta: Meta<typeof CollaborativeMarkdownEditor> = {
  title: "Editors/Collaborative Markdown Editor",
  component: CollaborativeMarkdownEditor,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof CollaborativeMarkdownEditor>;

/** Two editors syncing in real-time via in-memory Yjs. Type in one pane to see changes in the other. */
export const SplitView: StoryObj = {
  render: () => <SplitViewDemo />,
};

/** Single editor connecting to a WebSocket server. Requires a running API with WS support. */
export const SingleEditor: Story = {
  args: {
    roomId: "todo:story-demo",
    wsUrl: "ws://localhost:3000/v1/docs",
    userName: "Storybook User",
    userColor: "#30bced",
    placeholder: "Start typing collaboratively...",
  },
};
