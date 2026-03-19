import "../theme/rich-text-theme.css";

import { Flex } from "@chakra-ui/react";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $getRoot } from "lexical";
import { ContentEditable } from "../shared/components/content-editable";
import { DataTableNode } from "../shared/nodes/DataTableNode";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeBlockNode } from "../shared/plugins/CodePlugin/CodeNode";
import { EquationNode } from "../shared/plugins/EquationPlugin/EquationNode";
import { EQUATION_INLINE, EQUATION_MULTILINE, EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { HRNode } from "../shared/plugins/HorizontalRulePlugin/HorizontalRuleNode";
import StateUpdatePlugin from "../shared/plugins/StateUpdatePlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { TRANSFORMERS_EXTENDED } from "../shared/transformers/markdown-transformers";
import theme from "../theme/rich-text-theme";
import { splitFrontmatter } from "../utils/markdown";
import { REFERENCE_LINK_TRANSFORMER, ReferenceLinkNode } from "./plugins/ReferenceLinkPlugin";

export interface RichMessageProps {
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  onChange?: (value: string) => void;
}

const transformers = [
  ...TRANSFORMERS,
  ...TRANSFORMERS_EXTENDED,
  EQUATION_INLINE,
  EQUATION_MULTILINE,
  REFERENCE_LINK_TRANSFORMER,
];

export function RichMessage(props: RichMessageProps) {
  const { debug = false, defaultState = "", fullWidth = false, isEditable = false, onChange } = props;
  const { frontmatter, body } = splitFrontmatter(defaultState);
  const shouldTrackChanges = isEditable && Boolean(onChange);

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: [
      QuoteNode,
      LinkNode,
      DataTableNode,
      HeadingNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeBlockNode,
      EquationNode,
      HRNode,
      ReferenceLinkNode,
    ],
    editorState: () => {
      return $convertFromMarkdownString(body, transformers, undefined, false);
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
            $convertFromMarkdownString(value, transformers, undefined, false);
          }}
        />
        <LinkPlugin />
        <ListPlugin />
        <HorizontalRulePlugin />
        <ImportCodeBlocksPlugin />
        <EquationPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable fullWidth={fullWidth} />}
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
