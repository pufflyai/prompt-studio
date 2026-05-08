import "./LinkEditorPlugin.css";

import { Box } from "@chakra-ui/react";
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isLineBreakNode,
  $isRangeSelection,
  $setSelection,
  type BaseSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type React from "react";
import { type Dispatch, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOGGLE_LINK_EDIT_MODE_COMMAND } from "./commands";
import { LinkEditorContent } from "./link-editor-content";
import { getSelectedNode } from "./utils/getSelectedNode";
import { shouldCancelLinkEdit } from "./utils/link-edit-state";
import { getSelectionLinkUrl } from "./utils/selection-link-url";
import { setFloatingElemPos } from "./utils/setFloatingElemPos";
import { sanitizeUrl, validateUrl } from "./utils/url";

const GAP = 8;

function LinkEditor({
  editor,
  isLink,
  setIsLink,
  anchorElem,
  isLinkEditMode,
  setIsLinkEditMode,
}: {
  editor: LexicalEditor;
  isLink: boolean;
  setIsLink: Dispatch<boolean>;
  anchorElem: HTMLElement;
  isLinkEditMode: boolean;
  setIsLinkEditMode: Dispatch<boolean>;
}): React.JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateLinkEditorRef = useRef<() => void>(() => undefined);
  const [linkUrl, setLinkUrl] = useState("");
  const [editedLinkUrl, setEditedLinkUrl] = useState("https://");
  const [lastSelection, setLastSelection] = useState<BaseSelection | null>(null);
  const isActive = isLink || isLinkEditMode;
  const editedLinkUrlIsValid = validateUrl(editedLinkUrl);

  updateLinkEditorRef.current = () => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const nextLinkUrl = getSelectionLinkUrl(selection);
      setLinkUrl(nextLinkUrl);
      if (shouldCancelLinkEdit(isLinkEditMode, isLink, nextLinkUrl)) {
        closeLinkEditor();
      }
      if (isLinkEditMode && nextLinkUrl !== "") {
        setEditedLinkUrl(nextLinkUrl);
      }
    }
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    const hasNativeRange = nativeSelection !== null && nativeSelection.rangeCount > 0;

    if (
      selection !== null &&
      nativeSelection !== null &&
      hasNativeRange &&
      rootElement?.contains(nativeSelection.anchorNode) &&
      editor.isEditable()
    ) {
      const rangeRect = nativeSelection.getRangeAt(0).getBoundingClientRect();
      const topRect = new DOMRect(rangeRect.left, rangeRect.top, 0, rangeRect.height);
      setFloatingElemPos(topRect, editorElem, anchorElem, GAP, undefined, "above");
      setLastSelection(selection);
    } else if (!editorElem.contains(activeElement)) {
      if (rootElement !== null) {
        setFloatingElemPos(null, editorElem, anchorElem);
      }
      setLastSelection(null);
      setIsLinkEditMode(false);
      setLinkUrl("");
    }
  };

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        updateLinkEditorRef.current();
      });
    };

    window.addEventListener("resize", update);

    if (scrollerElem) {
      scrollerElem.addEventListener("scroll", update);
    }

    return () => {
      window.removeEventListener("resize", update);

      if (scrollerElem) {
        scrollerElem.removeEventListener("scroll", update);
      }
    };
  }, [anchorElem.parentElement, editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateLinkEditorRef.current();
        });
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditorRef.current();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          if (isLink) {
            setIsLink(false);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor, setIsLink, isLink]);

  useEffect(() => {
    editor.getEditorState().read(() => {
      updateLinkEditorRef.current();
    });
  }, [editor]);

  useLayoutEffect(() => {
    if (!isActive) {
      return;
    }

    editor.getEditorState().read(() => {
      updateLinkEditorRef.current();
    });
  }, [editor, isActive]);

  useEffect(() => {
    if (isLinkEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLinkEditMode]);

  const monitorInputInteraction = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleLinkSubmission();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeLinkEditor();
    }
  };

  const closeLinkEditor = () => {
    setEditedLinkUrl("https://");
    setIsLinkEditMode(false);
  };

  const handleLinkSubmission = () => {
    if (lastSelection === null || !editedLinkUrlIsValid) {
      return;
    }

    editor.update(() => {
      $setSelection(lastSelection);
    });
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl(editedLinkUrl));
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const parent = getSelectedNode(selection).getParent();
        if ($isAutoLinkNode(parent)) {
          const linkNode = $createLinkNode(parent.getURL(), {
            rel: parent.__rel,
            target: parent.__target,
            title: parent.__title,
          });
          parent.replace(linkNode, true);
        }
      }
    });
    closeLinkEditor();
  };

  return (
    <Box ref={editorRef} className={`link-editor ${isActive ? "active" : ""}`}>
      <LinkEditorContent
        isActive={isActive}
        isLinkEditMode={isLinkEditMode}
        editedLinkUrl={editedLinkUrl}
        editedLinkUrlIsValid={editedLinkUrlIsValid}
        linkUrl={linkUrl}
        href={sanitizeUrl(linkUrl)}
        inputRef={inputRef}
        onEditedLinkUrlChange={setEditedLinkUrl}
        onInputKeyDown={monitorInputInteraction}
        onClose={closeLinkEditor}
        onSubmit={handleLinkSubmission}
        onEdit={() => {
          setEditedLinkUrl(linkUrl);
          setIsLinkEditMode(true);
        }}
        onRemove={() => {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
        }}
      />
    </Box>
  );
}

function useLinkEditorToolbar(
  editor: LexicalEditor,
  anchorElem: HTMLElement,
  isLinkEditMode: boolean,
  setIsLinkEditMode: Dispatch<boolean>,
): React.JSX.Element | null {
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLink, setIsLink] = useState(false);

  useEffect(() => {
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
  }, [editor, setIsLinkEditMode]);

  return createPortal(
    <LinkEditor
      editor={activeEditor}
      isLink={isLink}
      anchorElem={anchorElem}
      setIsLink={setIsLink}
      isLinkEditMode={isLinkEditMode}
      setIsLinkEditMode={setIsLinkEditMode}
    />,
    anchorElem,
  );
}

export default function LinkEditorPlugin({ anchorElem = document.body }: { anchorElem?: HTMLElement }) {
  const [isLinkEditMode, setIsLinkEditMode] = useState(false);
  const [editor] = useLexicalComposerContext();
  return useLinkEditorToolbar(editor, anchorElem, isLinkEditMode, setIsLinkEditMode);
}
