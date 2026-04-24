import "../theme/rich-text-theme.css";

import { Box, Flex } from "@chakra-ui/react";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { CollaborationPluginV2__EXPERIMENTAL } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import type { Provider } from "@lexical/yjs";
import { useEffect, useRef, useState } from "react";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme } from "../shared/editor-config";
import { CodeBlockActionsPlugin } from "../shared/plugins/CodePlugin/CodeBlockActionsPlugin";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { FloatingTextFormatToolbarPlugin } from "../shared/plugins/FloatingTextFormatToolbarPlugin";
import { AwarenessCursorsCSS } from "./awareness-cursors";

export interface CollaborativeMarkdownEditorProps {
  roomId: string;
  wsUrl: string;
  wsParams?: Record<string, string>;
  userName?: string;
  userColor?: string;
  placeholder?: string;
}

export function CollaborativeMarkdownEditor(props: CollaborativeMarkdownEditorProps) {
  const { roomId, wsUrl, wsParams = {}, userName = "Anonymous", userColor = "#30bced", placeholder } = props;

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [floatingToolbarAnchorElem, setFloatingToolbarAnchorElem] = useState<HTMLElement | null>(null);
  const [synced, setSynced] = useState(false);

  // Keep collaborative state stable for the component lifetime.
  const [doc] = useState(() => new Y.Doc());
  const [provider] = useState(() => {
    const nextProvider = new WebsocketProvider(wsUrl, roomId, doc, { params: wsParams, connect: false });

    nextProvider.on("sync", (isSynced: boolean) => {
      if (isSynced) setSynced(true);
    });

    return nextProvider;
  });

  // Manage provider connect/disconnect lifecycle
  useEffect(() => {
    provider.connect();

    return () => {
      provider.disconnect();
    };
  }, [provider]);

  useEffect(() => {
    setFloatingToolbarAnchorElem(editorContainerRef.current);
  }, []);

  const initialConfig = {
    namespace: "COLLABORATIVE_EDITOR",
    nodes: editorNodes,
    editorState: null,
    onError: (error: Error) => console.error(error),
    editable: true,
    theme: editorTheme,
  };

  return (
    <Flex
      ref={editorContainerRef}
      className="rich-text"
      justifyContent="space-between"
      width="100%"
      maxWidth="100%"
      height="100%"
      position="relative"
      direction="column"
      overflow="visible"
    >
      <AwarenessCursorsCSS />

      <LexicalComposer initialConfig={initialConfig}>
        <LexicalCollaboration>
          <CollaborationPluginV2__EXPERIMENTAL
            id={roomId}
            doc={doc}
            provider={provider as unknown as Provider}
            __shouldBootstrapUnsafe={false}
            username={userName}
            cursorColor={userColor}
          />
          <LinkPlugin />
          <ListPlugin />
          <HorizontalRulePlugin />
          <CodeHighlightingPlugin />
          <ImportCodeBlocksPlugin />
          <CodeBlockActionsPlugin anchorElem={floatingToolbarAnchorElem} />
          <EquationPlugin />
          <RichTextPlugin
            contentEditable={<ContentEditable fullWidth={false} />}
            placeholder={
              synced && placeholder ? (
                <Box
                  position="absolute"
                  top="0"
                  color="fg.muted"
                  pointerEvents="none"
                  userSelect="none"
                  textStyle="paragraph/M/regular"
                >
                  {placeholder}
                </Box>
              ) : null
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          {floatingToolbarAnchorElem ? (
            <FloatingTextFormatToolbarPlugin anchorElem={floatingToolbarAnchorElem} />
          ) : null}
        </LexicalCollaboration>
      </LexicalComposer>
    </Flex>
  );
}
