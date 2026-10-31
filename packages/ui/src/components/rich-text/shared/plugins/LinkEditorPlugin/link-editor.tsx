import { Box } from "@chakra-ui/react";
import { $createLinkNode, $isAutoLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type BaseSelection,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_ESCAPE_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type React from "react";
import { type Dispatch, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUiScope } from "@/utils/ui-scope";
import { LinkEditorContent } from "./link-editor-content";
import { getSelectedNode } from "./utils/getSelectedNode";
import { shouldCancelLinkEdit } from "./utils/link-edit-state";
import { getSelectionLinkUrl } from "./utils/selection-link-url";
import { setFloatingElemPos } from "./utils/setFloatingElemPos";
import { sanitizeUrl, validateUrl } from "./utils/url";

const GAP = 8;

export function LinkEditor({
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
  const surfaceActive = useUiScope()?.active ?? true;
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateLinkEditorRef = useRef<() => void>(() => undefined);
  const [linkUrl, setLinkUrl] = useState("");
  const [editedLinkUrl, setEditedLinkUrl] = useState("https://");
  const [lastSelection, setLastSelection] = useState<BaseSelection | null>(null);
  const isActive = isLink || isLinkEditMode;
  const editedLinkUrlIsValid = validateUrl(editedLinkUrl);

  const updateLinkSelection = (selection: BaseSelection | null) => {
    if ($isRangeSelection(selection)) {
      const nextLinkUrl = getSelectionLinkUrl(selection);
      setLinkUrl(nextLinkUrl);
      if (shouldCancelLinkEdit(isLinkEditMode, isLink, nextLinkUrl)) {
        closeLinkEditor();
      }
      if (isLinkEditMode && nextLinkUrl !== "" && nextLinkUrl !== linkUrl) {
        setEditedLinkUrl(nextLinkUrl);
      }
    }
  };

  updateLinkEditorRef.current = () => {
    if (!surfaceActive) return;
    const selection = $getSelection();
    updateLinkSelection(selection);
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();
    const activeElement = document.activeElement;

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();
    const hasNativeRange = Boolean(nativeSelection?.rangeCount && rootElement?.contains(nativeSelection.anchorNode));

    if (selection !== null && nativeSelection !== null && hasNativeRange && editor.isEditable()) {
      const rangeRect = nativeSelection.getRangeAt(0).getBoundingClientRect();
      const topRect = new DOMRect(rangeRect.left, rangeRect.top, 0, rangeRect.height);
      setFloatingElemPos(topRect, editorElem, anchorElem, GAP, undefined, "above", "viewport");
      setLastSelection(selection);
    } else if (!isLinkEditMode && !editorElem.contains(activeElement)) {
      if (rootElement !== null) {
        setFloatingElemPos(null, editorElem, anchorElem, undefined, undefined, "legacy", "viewport");
      }
      setLastSelection(null);
      setIsLinkEditMode(false);
      setLinkUrl("");
    }
  };

  useEffect(() => {
    if (!surfaceActive) return;
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
  }, [anchorElem.parentElement, editor, surfaceActive]);

  useEffect(() => {
    if (!surfaceActive) return;
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
  }, [editor, setIsLink, isLink, surfaceActive]);

  useEffect(() => {
    if (!surfaceActive) return;
    editor.getEditorState().read(() => {
      updateLinkEditorRef.current();
    });
  }, [editor, surfaceActive]);

  useLayoutEffect(() => {
    if (!surfaceActive || !isActive) {
      return;
    }

    editor.getEditorState().read(() => {
      updateLinkEditorRef.current();
    });
  }, [editor, isActive, surfaceActive]);

  useEffect(() => {
    if (surfaceActive && isLinkEditMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLinkEditMode, surfaceActive]);

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
    <Box hidden={!surfaceActive} ref={editorRef} zIndex="tooltip" className={`link-editor ${isActive ? "active" : ""}`}>
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
