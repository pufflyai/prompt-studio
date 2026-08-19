import "../theme/rich-text-theme.css";

import { Box, Flex } from "@chakra-ui/react";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { $addUpdateTag, $getRoot } from "lexical";
import { useEffect, useRef, useState } from "react";
import { ContentEditable } from "../shared/components/content-editable";
import { editorNodes, editorTheme, editorTransformers } from "../shared/editor-config";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../shared/markdown-codec";
import type { MarkdownUrlResolver } from "../shared/markdown-url";
import { MarkdownUrlProvider } from "../shared/markdown-url-context";
import { CodeBlockActionsPlugin } from "../shared/plugins/CodePlugin/CodeBlockActionsPlugin";
import { ImportCodeBlocksPlugin } from "../shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "../shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "../shared/plugins/EquationPlugin/EquationPlugin";
import { FloatingTextFormatToolbarPlugin } from "../shared/plugins/FloatingTextFormatToolbarPlugin";
import { LinkEditorPlugin, LinkPlugin } from "../shared/plugins/LinkEditorPlugin";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { splitFrontmatter } from "../utils/markdown";
import { MarkdownSectionNavigationPlugin } from "./plugins/MarkdownSectionNavigationPlugin";
import { MarkdownSlashCommandPlugin } from "./plugins/MarkdownSlashCommandPlugin";
import { MarkdownHistoryPlugin } from "./plugins/markdown-history-plugin";
import type { MarkdownSectionNavigation } from "./plugins/markdown-section-navigation";

const INITIAL_IMPORT_TAG = "markdown-initial-import";

export interface MarkdownEditorProps {
  autoFocus?: boolean;
  debug?: boolean;
  defaultState: string;
  fullWidth?: boolean;
  isEditable?: boolean;
  padding?: string;
  placeholder?: string;
  scrollable?: boolean;
  sectionNavigation?: MarkdownSectionNavigation;
  resolveMarkdownUrl?: MarkdownUrlResolver;
  onActiveSectionChange?: (sectionId: string | null) => void;
  onChange?: (value: string) => void;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const {
    autoFocus = false,
    debug = false,
    defaultState = "",
    fullWidth = false,
    isEditable = false,
    padding = "sm",
    placeholder,
    scrollable = true,
    sectionNavigation,
    resolveMarkdownUrl,
    onActiveSectionChange,
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
      // Tag the mount-time import so change tracking can tell it apart from a
      // real edit. Lexical also tags it history-merge, but slash commands reuse
      // that tag for their inserts, so ignoring history-merge would swallow them.
      $addUpdateTag(INITIAL_IMPORT_TAG);
      importMarkdownToLexical(body, resolveMarkdownUrl);
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
      <MarkdownUrlProvider resolver={resolveMarkdownUrl}>
        <LexicalComposer initialConfig={initialConfig}>
          {isEditable ? <MarkdownSlashCommandPlugin /> : null}
          {sectionNavigation ? (
            <MarkdownSectionNavigationPlugin
              anchors={sectionNavigation.anchors}
              targetId={sectionNavigation.targetId}
              onActiveSectionChange={onActiveSectionChange}
            />
          ) : null}
          {autoFocus ? <AutoFocusPlugin /> : null}
          <MarkdownHistoryPlugin />
          <LinkPlugin />
          <ListPlugin />
          {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
          <CheckListPlugin />
          {isEditable ? <MarkdownShortcutPlugin transformers={editorTransformers} /> : null}
          <HorizontalRulePlugin />
          <CodeHighlightingPlugin />
          <ImportCodeBlocksPlugin />
          <CodeBlockActionsPlugin anchorElem={floatingToolbarAnchorElem} />
          <EquationPlugin />
          <RichTextPlugin
            contentEditable={<ContentEditable fullWidth={fullWidth} padding={padding} scrollable={scrollable} />}
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
                  <Box width="100%" maxWidth="45rem" color="fg.muted" textStyle="paragraph/M/regular">
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
              onChange={(editorState, _editor, tags) => {
                // Reporting the mount-time import as a change makes every mount
                // look like an edit and schedules a save of content the user
                // never touched.
                if (tags.has(INITIAL_IMPORT_TAG)) return;
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
