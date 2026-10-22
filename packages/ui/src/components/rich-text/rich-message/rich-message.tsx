import "../theme/rich-text-theme.css";

import { Flex, useRecipe } from "@chakra-ui/react";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { $addUpdateTag, $getRoot } from "lexical";
import { useRef } from "react";
import { ChatCodeLinkNode } from "@/components/chat-ui/links/chat-code-link-node";
import type { ChatLinkProps } from "@/components/chat-ui/links/chat-link";
import {
  ChatLinkProvider,
  ChatLinkStreamingContext,
  useChatLinkHandler,
} from "@/components/chat-ui/links/chat-link-context";
import { ChatLinkPlugin } from "@/components/chat-ui/links/chat-link-plugin";
import { ChatResourceLinkNode } from "@/components/chat-ui/links/chat-resource-link-node";
import { ChatWebLinkNode } from "@/components/chat-ui/links/chat-web-link-node";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme } from "../shared/editor-config";
import { importMarkdownToLexical } from "../shared/markdown-import";
import { createMarkdownSourceDocument } from "../shared/markdown-source-document";
import { MarkdownTableSettingsContext } from "../shared/markdown-table-settings-context";
import type { MarkdownUrlResolver } from "../shared/markdown-url";
import { MarkdownUrlProvider } from "../shared/markdown-url-context";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { ListMarkerWidthPlugin } from "../shared/plugins/list-marker-width-plugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { splitFrontmatter } from "../utils/markdown";
import { RichMessageStatePlugin, SOURCE_IMPORT_TAG } from "./rich-message-state-plugin";

export interface RichMessageProps extends ChatLinkProps {
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  streaming?: boolean;
  resolveMarkdownUrl?: MarkdownUrlResolver;
  onChange?: (value: string) => void;
}

const CHAT_TABLE_SETTINGS = { rowNumbers: false, wrapRows: true };

export function RichMessage(props: RichMessageProps) {
  const inherited = useChatLinkHandler();
  return (
    <ChatLinkProvider handler={props.linkHandler ?? inherited}>
      <ChatLinkStreamingContext value={props.streaming ?? false}>
        <RichMessageContent {...props} />
      </ChatLinkStreamingContext>
    </ChatLinkProvider>
  );
}

function RichMessageContent(props: RichMessageProps) {
  const {
    debug = false,
    defaultState = "",
    fullWidth = false,
    isEditable = false,
    streaming = false,
    resolveMarkdownUrl,
    onChange,
  } = props;
  const { frontmatter, body } = splitFrontmatter(defaultState);
  const shouldTrackChanges = isEditable && Boolean(onChange);
  const motion = useRecipe({ key: "streamingText" });
  const loadedRef = useRef({ body, resolver: resolveMarkdownUrl });
  const sourceDocumentRef = useRef<ReturnType<typeof createMarkdownSourceDocument> | null>(null);

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: [...editorNodes, ChatCodeLinkNode, ChatResourceLinkNode, ChatWebLinkNode],
    editorState: () => {
      $addUpdateTag(SOURCE_IMPORT_TAG);
      if (isEditable) {
        const document = createMarkdownSourceDocument(body, resolveMarkdownUrl);
        sourceDocumentRef.current = document;
        document.importToLexical();
      } else importMarkdownToLexical(body, resolveMarkdownUrl);
    },
    onError: (error: Error) => console.error(error),
    editable: isEditable,
    theme: editorTheme,
  };

  return (
    <Flex
      className="rich-text"
      data-rich-message="true"
      css={motion()}
      justifyContent="space-between"
      width="100%"
      maxWidth="100%"
      height="100%"
      position="relative"
      direction="column"
      overflow="hidden"
    >
      <MarkdownUrlProvider resolver={resolveMarkdownUrl}>
        <MarkdownTableSettingsContext value={CHAT_TABLE_SETTINGS}>
          <LexicalComposer initialConfig={initialConfig}>
            <RichMessageStatePlugin
              body={body}
              resolver={resolveMarkdownUrl}
              isEditable={isEditable}
              streaming={streaming}
              loadedRef={loadedRef}
              sourceDocumentRef={sourceDocumentRef}
            />
            {isEditable ? <LinkPlugin /> : null}
            <ChatLinkPlugin />
            <ClickableLinkPlugin newTab />
            {isEditable ? <ListPlugin /> : null}
            <ListMarkerWidthPlugin />
            {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
            {isEditable ? <HorizontalRulePlugin /> : null}
            {!streaming ? <CodeHighlightingPlugin /> : null}
            {isEditable ? <ImportCodeBlocksPlugin /> : null}
            <EquationPlugin />
            <RichTextPlugin
              contentEditable={<ContentEditable fullWidth={fullWidth} isRichMessage />}
              ErrorBoundary={LexicalErrorBoundary}
            />
            {shouldTrackChanges ? (
              <OnChangePlugin
                ignoreSelectionChange
                ignoreHistoryMergeTagChange={false}
                onChange={(editorState, _editor, tags) => {
                  if (tags.has(SOURCE_IMPORT_TAG)) return;
                  editorState.read(() => {
                    const root = $getRoot();
                    const markdownBody = sourceDocumentRef.current?.exportFromLexical(root) ?? "";
                    onChange?.(frontmatter + markdownBody);
                  });
                }}
              />
            ) : null}
            <ToggleEditablePlugin isEditable={isEditable} />
            {debug && <TreeViewPlugin />}
          </LexicalComposer>
        </MarkdownTableSettingsContext>
      </MarkdownUrlProvider>
    </Flex>
  );
}
