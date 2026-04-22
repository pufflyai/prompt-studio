import "./FloatingTextFormatToolbarPlugin.css";

import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  isSelectionCapturedInDecoratorInput,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type React from "react";
import { type Dispatch, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { insertCodeBlockFromSelection } from "../CodePlugin/code-block-utils";
import { setFloatingElemPos } from "../LinkEditorPlugin/utils/setFloatingElemPos";
import { FloatingTextToolbarControls } from "./floating-text-toolbar-controls";
import { type BlockType, resolveBlockTypeFromAnchor } from "./resolve-block-type";

// Increase the vertical gap (negative places it below the selection) to avoid overlap
const GAP = -4;

function FloatingTextToolbar({
  editor,
  anchorElem,
  isToolbarActive,
  setIsToolbarActive,
}: {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
  isToolbarActive: boolean;
  setIsToolbarActive: Dispatch<boolean>;
}): React.JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const updateFloatingToolbarRef = useRef<() => boolean | undefined>(() => undefined);

  const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      const factory = blockType === headingSize ? $createParagraphNode : () => $createHeadingNode(headingSize);
      $setBlocksType(selection, factory);
    });
  };

  const formatList = (type: "bullet" | "number" | "check") => {
    if (blockType === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      return;
    }
    const command = {
      bullet: INSERT_UNORDERED_LIST_COMMAND,
      number: INSERT_ORDERED_LIST_COMMAND,
      check: INSERT_CHECK_LIST_COMMAND,
    }[type];
    editor.dispatchCommand(command, undefined);
  };

  const formatCodeBlock = () => {
    editor.update(() => {
      insertCodeBlockFromSelection();
    });
  };

  const updateToolbar = () => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));

    const nextBlockType = resolveBlockTypeFromAnchor(selection.anchor.getNode());
    if (nextBlockType) {
      setBlockType(nextBlockType);
    }
  };

  updateFloatingToolbarRef.current = () => {
    const selection = $getSelection();
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();

    // Show floating toolbar when there's a non-collapsed text selection
    if (
      selection !== null &&
      $isRangeSelection(selection) &&
      nativeSelection !== null &&
      nativeSelection.anchorNode !== null &&
      !isSelectionCapturedInDecoratorInput(nativeSelection.anchorNode) &&
      rootElement?.contains(nativeSelection.anchorNode) &&
      editor.isEditable()
    ) {
      const domRect: DOMRect | undefined = nativeSelection.getRangeAt(0).getBoundingClientRect();

      if (domRect) {
        // Anchor to the bottom of the selection to avoid overlap with tall selections
        const bottomRect = new DOMRect(domRect.left, domRect.bottom, 0, 0);
        setFloatingElemPos(bottomRect, editorElem, anchorElem, GAP);
      }

      setIsToolbarActive(true);
    } else {
      if (rootElement !== null) {
        setFloatingElemPos(null, editorElem, anchorElem);
      }
      setIsToolbarActive(false);
    }

    updateToolbar();

    return true;
  };

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        updateFloatingToolbarRef.current();
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
  }, [anchorElem, editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateFloatingToolbarRef.current();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload) => {
          updateFloatingToolbarRef.current();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (_payload) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            updateFloatingToolbarRef.current();
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor]);

  return (
    <div ref={editorRef} className={`floating-text-format-toolbar ${isToolbarActive ? "active" : ""}`}>
      <FloatingTextToolbarControls
        blockType={blockType}
        editor={editor}
        formatCodeBlock={formatCodeBlock}
        formatHeading={formatHeading}
        formatList={formatList}
        isBold={isBold}
        isItalic={isItalic}
        isUnderline={isUnderline}
        preserveSelection={preserveSelection}
      />
    </div>
  );
}

export function FloatingTextFormatToolbarPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [isToolbarActive, setIsToolbarActive] = useState(false);

  return createPortal(
    <FloatingTextToolbar
      editor={editor}
      anchorElem={anchorElem}
      isToolbarActive={isToolbarActive}
      setIsToolbarActive={setIsToolbarActive}
    />,
    anchorElem,
  );
}
