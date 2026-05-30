import "../theme/rich-text-theme.css";

import { Flex } from "@chakra-ui/react";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot } from "lexical";
import { ContentEditable } from "../shared/components/content-editable";
import { baseEditorTransformers } from "../shared/editor-config";
import { CodeHighlightNode, CodeNode } from "../shared/lexical-code";
import { DataTableNode } from "../shared/nodes/DataTableNode";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationNode } from "../shared/plugins/EquationPlugin/EquationNode";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { HRNode } from "../shared/plugins/HorizontalRulePlugin/HorizontalRuleNode";
import { MermaidNode } from "../shared/plugins/MermaidPlugin/MermaidNode";
import StateUpdatePlugin from "../shared/plugins/StateUpdatePlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import theme from "../theme/rich-text-theme";
import { normalizeMarkdownListIndentation, splitFrontmatter } from "../utils/markdown";
import { REFERENCE_LINK_TRANSFORMER, ReferenceLinkNode } from "./plugins/ReferenceLinkPlugin";

export interface RichMessageProps {
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  onChange?: (value: string) => void;
}

const transformers = [...baseEditorTransformers, REFERENCE_LINK_TRANSFORMER];

export function RichMessage(props: RichMessageProps) {
  const { debug = false, defaultState = "", fullWidth = false, isEditable = false, onChange } = props;
  const { frontmatter, body } = splitFrontmatter(defaultState);
  const shouldTrackChanges = isEditable && Boolean(onChange);

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: [
      QuoteNode,
      LinkNode,
      AutoLinkNode,
      DataTableNode,
      HeadingNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      MermaidNode,
      EquationNode,
      HRNode,
      ReferenceLinkNode,
    ],
    editorState: () => {
      return $convertFromMarkdownString(normalizeMarkdownListIndentation(body), transformers, undefined, false);
    },
    onError: (error: Error) => console.error(error),
    editable: isEditable,
    theme,
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
      <LexicalComposer initialConfig={initialConfig}>
        <StateUpdatePlugin
          value={body}
          onUpdate={(value: string) => {
            $convertFromMarkdownString(normalizeMarkdownListIndentation(value), transformers, undefined, false);
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
                const markdownBody = $convertToMarkdownString(transformers, root);
                onChange?.(frontmatter + markdownBody);
              });
            }}
          />
        ) : null}
        <ToggleEditablePlugin isEditable={isEditable} />
        {debug && <TreeViewPlugin />}
      </LexicalComposer>
    </Flex>
  );
}
