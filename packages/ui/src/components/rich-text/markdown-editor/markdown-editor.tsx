import "../theme/rich-text-theme.css";

import { Box, Flex } from "@chakra-ui/react";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getRoot } from "lexical";
import { useEffect, useRef, useState } from "react";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme, editorTransformers } from "../shared/editor-config";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { FloatingTextFormatToolbarPlugin } from "../shared/plugins/FloatingTextFormatToolbarPlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { splitFrontmatter } from "../utils/markdown";

export interface MarkdownEditorProps {
  autoFocus?: boolean;
  debug?: boolean;
  defaultState: string;
  isEditable?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const { autoFocus = false, debug = false, defaultState = "", isEditable = false, placeholder, onChange } = props;
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
      return $convertFromMarkdownString(body, editorTransformers, undefined, false);
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
      height="100%"
      position="relative"
      direction="column"
      overflow="visible"
    >
      <LexicalComposer initialConfig={initialConfig}>
        {autoFocus ? <AutoFocusPlugin /> : null}
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <HorizontalRulePlugin />
        <ImportCodeBlocksPlugin />
        <EquationPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable fullWidth={false} padding="sm" />}
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
          <FloatingTextFormatToolbarPlugin anchorElem={floatingToolbarAnchorElem} />
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
