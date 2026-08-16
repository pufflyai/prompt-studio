import "../theme/rich-text-theme.css";

import { Flex } from "@chakra-ui/react";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { $getRoot } from "lexical";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme } from "../shared/editor-config";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../shared/markdown-codec";
import type { MarkdownUrlResolver } from "../shared/markdown-url";
import { MarkdownUrlProvider } from "../shared/markdown-url-context";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import StateUpdatePlugin from "../shared/plugins/StateUpdatePlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { splitFrontmatter } from "../utils/markdown";

export interface RichMessageProps {
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  resolveMarkdownUrl?: MarkdownUrlResolver;
  onChange?: (value: string) => void;
}

export function RichMessage(props: RichMessageProps) {
  const {
    debug = false,
    defaultState = "",
    fullWidth = false,
    isEditable = false,
    resolveMarkdownUrl,
    onChange,
  } = props;
  const { frontmatter, body } = splitFrontmatter(defaultState);
  const shouldTrackChanges = isEditable && Boolean(onChange);

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: editorNodes,
    editorState: () => {
      importMarkdownToLexical(body, resolveMarkdownUrl);
    },
    onError: (error: Error) => console.error(error),
    editable: isEditable,
    theme: editorTheme,
  };

  return (
    <Flex
      className="rich-text"
      data-rich-message="true"
      justifyContent="space-between"
      width="100%"
      maxWidth="100%"
      height="100%"
      position="relative"
      direction="column"
      overflow="hidden"
    >
      <MarkdownUrlProvider resolver={resolveMarkdownUrl}>
        <LexicalComposer initialConfig={initialConfig}>
          <StateUpdatePlugin
            value={body}
            onUpdate={(value: string) => {
              importMarkdownToLexical(value, resolveMarkdownUrl);
            }}
          />
          <LinkPlugin />
          <ClickableLinkPlugin newTab />
          <ListPlugin />
          {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
          <HorizontalRulePlugin />
          <CodeHighlightingPlugin />
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
              onChange={(editorState) => {
                editorState.read(() => {
                  const root = $getRoot();
                  const markdownBody = exportLexicalToMarkdown(root);
                  onChange?.(frontmatter + markdownBody);
                });
              }}
            />
          ) : null}
          <ToggleEditablePlugin isEditable={isEditable} />
          {debug && <TreeViewPlugin />}
        </LexicalComposer>
      </MarkdownUrlProvider>
    </Flex>
  );
}
