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
import { ChatLinkProvider, useChatLinkHandler } from "@/components/chat-ui/links/chat-link-context";
import { ChatLinkPlugin } from "@/components/chat-ui/links/chat-link-plugin";
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
import StateUpdatePlugin from "../shared/plugins/StateUpdatePlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { importStreamingMarkdownToLexical } from "../shared/streaming-markdown";
import { splitFrontmatter } from "../utils/markdown";

export interface RichMessageProps extends ChatLinkProps {
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  streaming?: boolean;
  resolveMarkdownUrl?: MarkdownUrlResolver;
  onChange?: (value: string) => void;
}

const SOURCE_IMPORT_TAG = "markdown-source-import";
const CHAT_TABLE_SETTINGS = { rowNumbers: false, wrapRows: true };

export function RichMessage(props: RichMessageProps) {
  const inherited = useChatLinkHandler();
  return (
    <ChatLinkProvider handler={props.linkHandler ?? inherited}>
      <RichMessageContent {...props} />
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
  sourceDocumentRef.current ??= createMarkdownSourceDocument(body, resolveMarkdownUrl);

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: [...editorNodes, ChatCodeLinkNode],
    editorState: () => {
      $addUpdateTag(SOURCE_IMPORT_TAG);
      if (isEditable) sourceDocumentRef.current?.importToLexical();
      else importMarkdownToLexical(body, resolveMarkdownUrl);
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
            <StateUpdatePlugin
              value={body}
              onUpdate={(value: string) => {
                const previous = loadedRef.current;
                if (previous.body === value && previous.resolver === resolveMarkdownUrl) return;
                $addUpdateTag(SOURCE_IMPORT_TAG);
                if (isEditable) {
                  const sourceDocument = createMarkdownSourceDocument(value, resolveMarkdownUrl);
                  sourceDocumentRef.current = sourceDocument;
                  sourceDocument.importToLexical();
                } else {
                  importStreamingMarkdownToLexical(
                    value,
                    resolveMarkdownUrl,
                    streaming && value.startsWith(previous.body),
                  );
                }
                loadedRef.current = { body: value, resolver: resolveMarkdownUrl };
              }}
            />
            <LinkPlugin />
            <ChatLinkPlugin />
            <ClickableLinkPlugin newTab />
            <ListPlugin />
            <ListMarkerWidthPlugin />
            {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
            <HorizontalRulePlugin />
            {!streaming ? <CodeHighlightingPlugin /> : null}
            <ImportCodeBlocksPlugin />
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
