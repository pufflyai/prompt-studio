import "./FloatingTextFormatToolbarPlugin.css";

import { $isAutoLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type React from "react";
import { type Dispatch, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { $createCodeNode } from "../../lexical-code";
import { TOGGLE_LINK_EDIT_MODE_COMMAND } from "../LinkEditorPlugin/commands";
import { getSelectedNode } from "../LinkEditorPlugin/utils/getSelectedNode";
import { setFloatingElemPos } from "../LinkEditorPlugin/utils/setFloatingElemPos";
import { FloatingToolbarButtons } from "./floating-toolbar-buttons";
import { type BlockType, resolveBlockTypeFromAnchor } from "./resolve-block-type";
import { shouldShowFloatingToolbar } from "./should-show-floating-toolbar";

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
  const [isLink, setIsLink] = useState(false);
  const updateFloatingToolbarRef = useRef<() => boolean | undefined>(() => undefined);

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      if (blockType === headingSize) {
        $setBlocksType(selection, $createParagraphNode);
        return;
      }

      $setBlocksType(selection, () => $createHeadingNode(headingSize));
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
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      if (blockType === "code") {
        $setBlocksType(selection, $createParagraphNode);
        return;
      }

      $setBlocksType(selection, () => $createCodeNode());
    });
  };

  const insertLink = () => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_EDIT_MODE_COMMAND, true);
  };

  const updateToolbar = () => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setIsBold(selection.hasFormat("bold"));
    setIsItalic(selection.hasFormat("italic"));
    setIsUnderline(selection.hasFormat("underline"));

    const node = getSelectedNode(selection);
    const linkParent = $findMatchingParent(node, $isLinkNode);
    const autoLinkParent = $findMatchingParent(node, $isAutoLinkNode);
    setIsLink(linkParent !== null || autoLinkParent !== null);

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
    const hasNativeSelection = nativeSelection !== null;
    const hasNativeRange = hasNativeSelection && nativeSelection.rangeCount > 0;
    const isAnchorInsideEditor = Boolean(rootElement?.contains(hasNativeSelection ? nativeSelection.anchorNode : null));

    if (
      shouldShowFloatingToolbar({
        hasSelection: selection !== null,
        isRangeSelection: $isRangeSelection(selection),
        isCollapsed: $isRangeSelection(selection) ? selection.isCollapsed() : false,
        hasNativeSelection,
        hasNativeRange,
        isAnchorInsideEditor,
        isEditorEditable: editor.isEditable(),
      }) &&
      nativeSelection
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
      <FloatingToolbarButtons
        editor={editor}
        blockType={blockType}
        isBold={isBold}
        isItalic={isItalic}
        isUnderline={isUnderline}
        isLink={isLink}
        formatHeading={formatHeading}
        formatList={formatList}
        formatCodeBlock={formatCodeBlock}
        insertLink={insertLink}
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
