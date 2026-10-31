import "./LinkEditorPlugin.css";
import { $isAutoLinkNode, $isLinkNode } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type React from "react";
import { type Dispatch, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUiScope } from "@/utils/ui-scope";
import { TOGGLE_LINK_EDIT_MODE_COMMAND } from "./commands";
import { LinkEditor } from "./link-editor";
import { getSelectedNode } from "./utils/getSelectedNode";
import { sanitizeUrl } from "./utils/url";

function useLinkEditorToolbar(
  editor: LexicalEditor,
  anchorElem: HTMLElement,
  isLinkEditMode: boolean,
  setIsLinkEditMode: Dispatch<boolean>,
): React.JSX.Element | null {
  const surfaceActive = useUiScope()?.active ?? true;
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLink, setIsLink] = useState(false);

  useEffect(() => {
    if (!surfaceActive) return;
    function $updateToolbar() {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const focusNode = getSelectedNode(selection);
        const focusLinkNode = $findMatchingParent(focusNode, $isLinkNode);
        const focusAutoLinkNode = $findMatchingParent(focusNode, $isAutoLinkNode);
        if (!(focusLinkNode || focusAutoLinkNode)) {
          setIsLink(false);
          return;
        }
        const badNode = selection
          .getNodes()
          .filter((node) => !$isLineBreakNode(node))
          .find((node) => {
            const linkNode = $findMatchingParent(node, $isLinkNode);
            const autoLinkNode = $findMatchingParent(node, $isAutoLinkNode);
            const autoLinkIsUnlinked = $isAutoLinkNode(autoLinkNode) && autoLinkNode.getIsUnlinked();
            return (
              (focusLinkNode && !focusLinkNode.is(linkNode)) ||
              (linkNode && !linkNode.is(focusLinkNode)) ||
              (focusAutoLinkNode && !focusAutoLinkNode.is(autoLinkNode)) ||
              (autoLinkNode && (!autoLinkNode.is(focusAutoLinkNode) || autoLinkIsUnlinked))
            );
          });
        if (!badNode) {
          setIsLink(true);
        } else {
          setIsLink(false);
        }
      }
    }
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, newEditor) => {
          $updateToolbar();
          setActiveEditor(newEditor);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (payload) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const node = getSelectedNode(selection);
            const linkNode = $findMatchingParent(node, $isLinkNode);
            if ($isLinkNode(linkNode) && (payload.metaKey || payload.ctrlKey)) {
              window.open(sanitizeUrl(linkNode.getURL()), "_blank", "noopener,noreferrer");
              return true;
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        TOGGLE_LINK_EDIT_MODE_COMMAND,
        (payload) => {
          setIsLinkEditMode(payload);
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, setIsLinkEditMode, surfaceActive]);

  return createPortal(
    <LinkEditor
      editor={activeEditor}
      isLink={isLink}
      anchorElem={anchorElem}
      setIsLink={setIsLink}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    document.body,
  );
}

export default function LinkEditorPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }) {
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);
  const [editor] = useLexicalComposerContext();
  return useLinkEditorToolbar(editor, anchorElem, isLinkEditMode, setIsLinkEditMode);
}
