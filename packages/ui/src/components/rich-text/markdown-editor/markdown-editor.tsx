import "../theme/rich-text-theme.css";

import { Box, Flex } from "@chakra-ui/react";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { $getRoot } from "lexical";
import { useEffect, useRef, useState } from "react";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme, editorTransformers } from "../shared/editor-config";
import { CodeBlockActionsPlugin } from "../shared/plugins/CodePlugin/CodeBlockActionsPlugin";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { FloatingTextFormatToolbarPlugin } from "../shared/plugins/FloatingTextFormatToolbarPlugin";
import { LinkEditorPlugin, LinkPlugin } from "../shared/plugins/LinkEditorPlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { normalizeMarkdownListIndentation, splitFrontmatter } from "../utils/markdown";

export interface MarkdownEditorProps {
  autoFocus?: boolean;
  debug?: boolean;
  defaultState: string;
  isEditable?: boolean;
  placeholder?: string;
  scrollable?: boolean;
  onChange?: (value: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const {
    autoFocus = false,
    debug = false,
    defaultState = "",
    isEditable = false,
    placeholder,
    scrollable = true,
    onChange,
  } = props;
  const { frontmatter, body } = splitFrontmatter(defaultState);
  const shouldTrackChanges = isEditable && Boolean(onChange);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [floatingToolbarAnchorElem, setFloatingToolbarAnchorElem] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFloatingToolbarAnchorElem(editorContainerRef.current);
  }, []);

  const initialConfig = {
    namespace: "MARKDOWN_EDITOR",
    nodes: editorNodes,
    editorState: () => {
      return $convertFromMarkdownString(normalizeMarkdownListIndentation(body), editorTransformers, undefined, false);
    },
    onError: (error: Error) => console.error(error),
    editable: isEditable,
    theme: editorTheme,
  };

  return (
    <Flex
      ref={editorContainerRef}
      className="rich-text"
      justifyContent="space-between"
      width="100%"
      maxWidth="100%"
      height={scrollable ? "100%" : "auto"}
      position="relative"
      direction="column"
      overflow="visible"
    >
      <LexicalComposer initialConfig={initialConfig}>
        {autoFocus ? <AutoFocusPlugin /> : null}
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
        <CheckListPlugin />
        <HorizontalRulePlugin />
        <CodeHighlightingPlugin />
        <ImportCodeBlocksPlugin />
        <CodeBlockActionsPlugin anchorElem={floatingToolbarAnchorElem} />
        <EquationPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable fullWidth={false} padding="sm" scrollable={scrollable} />}
          placeholder={
            placeholder ? (
              <Flex
                position="absolute"
                padding="sm"
                top="0"
                left="0"
                right="0"
                pointerEvents="none"
                userSelect="none"
                justifyContent="center"
              >
                <Box width="100%" maxWidth="720px" color="fg.muted" textStyle="paragraph/M/regular">
                  {placeholder}
                </Box>
              </Flex>
            ) : null
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {isEditable && floatingToolbarAnchorElem ? (
          <>
            <FloatingTextFormatToolbarPlugin anchorElem={floatingToolbarAnchorElem} />
            <LinkEditorPlugin anchorElem={floatingToolbarAnchorElem} />
          </>
        ) : null}
        {shouldTrackChanges ? (
          <OnChangePlugin
            ignoreSelectionChange
            ignoreHistoryMergeTagChange={false}
            onChange={(editorState) => {
              editorState.read(() => {
                const root = $getRoot();
                const markdownBody = $convertToMarkdownString(editorTransformers, root);
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
