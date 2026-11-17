import "@/components/rich-text/theme/rich-text-theme.css";

import { Box, Flex } from "@chakra-ui/react";
import { MarkNode } from "@lexical/mark";
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
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MarkdownSectionNavigationPlugin } from "@/components/rich-text/markdown-editor/plugins/MarkdownSectionNavigationPlugin";
import { MarkdownSlashCommandPlugin } from "@/components/rich-text/markdown-editor/plugins/MarkdownSlashCommandPlugin";
import {
  type MarkdownCollaboration,
  MarkdownCollaborationPlugin,
} from "@/components/rich-text/markdown-editor/plugins/markdown-collaboration-plugin";
import { MarkdownHistoryPlugin } from "@/components/rich-text/markdown-editor/plugins/markdown-history-plugin";
import { MarkdownPresencePlugin } from "@/components/rich-text/markdown-editor/plugins/markdown-presence-plugin";
import type { MarkdownSectionNavigation } from "@/components/rich-text/markdown-editor/plugins/markdown-section-navigation";
import { ContentEditable } from "@/components/rich-text/shared/components/content-editable";
import { editorNodes, editorTheme, editorTransformers } from "@/components/rich-text/shared/editor-config";
import {
  type MarkdownDocumentBinding,
  MarkdownDocumentContext,
} from "@/components/rich-text/shared/markdown-document-context";
import { createMarkdownSourceDocument } from "@/components/rich-text/shared/markdown-source-document";
import type { MarkdownUrlResolver } from "@/components/rich-text/shared/markdown-url";
import { MarkdownUrlProvider } from "@/components/rich-text/shared/markdown-url-context";
import { CodeBlockActionsPlugin } from "@/components/rich-text/shared/plugins/CodePlugin/CodeBlockActionsPlugin";
import { ImportCodeBlocksPlugin } from "@/components/rich-text/shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeHighlightingPlugin } from "@/components/rich-text/shared/plugins/CodePlugin/CodeHighlightingPlugin";
import { EquationPlugin } from "@/components/rich-text/shared/plugins/EquationPlugin/EquationPlugin";
import { LinkEditorPlugin, LinkPlugin } from "@/components/rich-text/shared/plugins/LinkEditorPlugin";
import { ListMarkerWidthPlugin } from "@/components/rich-text/shared/plugins/list-marker-width-plugin";
import ToggleEditablePlugin from "@/components/rich-text/shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "@/components/rich-text/shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { joinFrontmatter, splitFrontmatter } from "@/components/rich-text/utils/markdown";
import { FloatingTextFormatToolbarPlugin } from "./FloatingTextFormatToolbarPlugin";

const INITIAL_IMPORT_TAG = "markdown-initial-import";

export interface MarkdownEditorProps {
  reviewPlugin?: ReactNode;
  onComment?: () => void;
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
  collaboration?: MarkdownCollaboration;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const {
    reviewPlugin,
    onComment,
    autoFocus = false,
    debug = false,
    defaultState = "",
    fullWidth = false,
    isEditable = false,
    padding,
    placeholder,
    scrollable = true,
    sectionNavigation,
    resolveMarkdownUrl,
    onActiveSectionChange,
    onChange,
    collaboration,
  } = props;
  const sharedText = collaboration?.session?.getSnapshot().text ?? collaboration?.document?.getText("content");
  const { frontmatter, body } = splitFrontmatter(sharedText?.toString() ?? defaultState);
  const [finishing, setFinishing] = useState(false);
  const editable = isEditable && !finishing;
  const shouldTrackChanges = !collaboration && isEditable && Boolean(onChange);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const collaborationRef = useRef<MarkdownDocumentBinding | null>(null);
  const sourceDocumentRef = useRef<ReturnType<typeof createMarkdownSourceDocument> | null>(null);
  sourceDocumentRef.current ??= createMarkdownSourceDocument(body, resolveMarkdownUrl);
  const sourceDocument = sourceDocumentRef.current;
  const [floatingToolbarAnchorElem, setFloatingToolbarAnchorElem] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setFloatingToolbarAnchorElem(editorContainerRef.current);
  }, []);

  const initialConfig = {
    namespace: "MARKDOWN_EDITOR",
    nodes: [...editorNodes, MarkNode],
    editorState: () => {
      // Tag the mount-time import so change tracking can tell it apart from a
      // real edit. Lexical also tags it history-merge, but slash commands reuse
      // that tag for their inserts, so ignoring history-merge would swallow them.
      $addUpdateTag(INITIAL_IMPORT_TAG);
      sourceDocument.importToLexical();
    },
    onError: (error: Error) => console.error(error),
    editable: isEditable,
    theme: { ...editorTheme, mark: "rich-text__mark", markOverlap: "rich-text__markOverlap" },
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
        <MarkdownDocumentContext.Provider value={collaboration ? collaborationRef : null}>
          <LexicalComposer initialConfig={initialConfig}>
            {isEditable ? <MarkdownSlashCommandPlugin /> : null}
            {sectionNavigation ? (
              <MarkdownSectionNavigationPlugin
                anchors={sectionNavigation.anchors}
                targetId={sectionNavigation.targetId}
                onActiveSectionChange={onActiveSectionChange}
              />
            ) : null}
            {reviewPlugin}
            {autoFocus ? <AutoFocusPlugin /> : null}
            {!collaboration && <MarkdownHistoryPlugin />}
            <LinkPlugin />
            <ListPlugin />
            <ListMarkerWidthPlugin />
            {isEditable ? <TabIndentationPlugin maxIndent={7} /> : null}
            <CheckListPlugin />
            {isEditable ? <MarkdownShortcutPlugin transformers={editorTransformers} /> : null}
            <HorizontalRulePlugin />
            <CodeHighlightingPlugin />
            <ImportCodeBlocksPlugin />
            <CodeBlockActionsPlugin anchorElem={floatingToolbarAnchorElem} />
            <EquationPlugin />
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  fullWidth={fullWidth}
                  padding={padding}
                  layerStyle="markdownEditorInset"
                  scrollable={scrollable}
                />
              }
              placeholder={
                placeholder ? (
                  <Flex
                    position="absolute"
                    layerStyle="markdownEditorInset"
                    padding={padding}
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
                <FloatingTextFormatToolbarPlugin anchorElem={floatingToolbarAnchorElem} onComment={onComment} />
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
                  if (tags.has(INITIAL_IMPORT_TAG) || tags.has("review-markers")) return;
                  editorState.read(() => {
                    const root = $getRoot();
                    const markdownBody = sourceDocument.exportFromLexical(root);
                    onChange?.(joinFrontmatter(frontmatter, markdownBody));
                  });
                }}
              />
            ) : null}
            <ToggleEditablePlugin isEditable={editable} />
            {collaboration && (
              <MarkdownPresencePlugin
                collaboration={collaboration}
                source={sourceDocument}
                bindingRef={collaborationRef}
                containerRef={editorContainerRef}
              />
            )}
            {debug && <TreeViewPlugin />}
            {collaboration && (
              <MarkdownCollaborationPlugin
                collaboration={collaboration}
                source={sourceDocument}
                editable={isEditable}
                onChange={onChange}
                bindingRef={collaborationRef}
                onFinishingChange={setFinishing}
              />
            )}
          </LexicalComposer>
        </MarkdownDocumentContext.Provider>
      </MarkdownUrlProvider>
    </Flex>
  );
}
