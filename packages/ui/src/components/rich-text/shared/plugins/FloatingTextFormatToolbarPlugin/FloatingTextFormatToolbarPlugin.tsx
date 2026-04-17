import "./FloatingTextFormatToolbarPlugin.css";

import { IconButton, Stack, Text } from "@chakra-ui/react";
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
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import { List, ListOrdered, ListTodo } from "lucide-react";
import type React from "react";
import { type Dispatch, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "../../../../tooltip";
import { setFloatingElemPos } from "../LinkEditorPlugin/utils/setFloatingElemPos";
import { type BlockType, resolveBlockTypeFromAnchor } from "./resolve-block-type";

// Increase the vertical gap (negative places it below the selection) to avoid overlap
const GAP = -4;

function ToolbarSeparator() {
  return (
    <span
      style={{
        display: "inline-flex",
        height: "1rem",
        margin: "0 0.25rem",
        borderLeft: "1px solid var(--chakra-colors-border-muted)",
      }}
    />
  );
}

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
      !selection.isCollapsed() &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
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
      <Stack direction="row" gap="0.5" alignItems="center">
        {/* Text formatting buttons */}
        <Tooltip content="Bold">
          <IconButton
            data-active={isBold || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
            }}
            variant="ghost"
            aria-label="Bold"
            size="xs"
          >
            <Text fontWeight="bold" fontSize=".75rem">
              B
            </Text>
          </IconButton>
        </Tooltip>
        <Tooltip content="Italic">
          <IconButton
            data-active={isItalic || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
            }}
            variant="ghost"
            aria-label="Italic"
            size="xs"
          >
            <Text fontStyle="italic" fontSize=".75rem">
              I
            </Text>
          </IconButton>
        </Tooltip>
        <Tooltip content="Underline">
          <IconButton
            data-active={isUnderline || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
            }}
            variant="ghost"
            aria-label="Underline"
            size="xs"
          >
            <Text textDecoration="underline" fontSize=".75rem">
              U
            </Text>
          </IconButton>
        </Tooltip>

        <ToolbarSeparator />

        {/* Heading buttons */}
        <Tooltip content="Heading 1">
          <IconButton
            data-active={blockType === "h1" || undefined}
            variant="ghost"
            aria-label="Heading 1"
            size="xs"
            onClick={() => {
              formatHeading("h1");
            }}
          >
            <Text fontWeight="thin" fontSize=".8rem">
              H1
            </Text>
          </IconButton>
        </Tooltip>
        <Tooltip content="Heading 2">
          <IconButton
            data-active={blockType === "h2" || undefined}
            variant="ghost"
            aria-label="Heading 2"
            size="xs"
            onClick={() => {
              formatHeading("h2");
            }}
          >
            <Text fontWeight="thin" fontSize=".8rem">
              H2
            </Text>
          </IconButton>
        </Tooltip>
        <Tooltip content="Heading 3">
          <IconButton
            data-active={blockType === "h3" || undefined}
            variant="ghost"
            aria-label="Heading 3"
            size="xs"
            onClick={() => {
              formatHeading("h3");
            }}
          >
            <Text fontWeight="thin" fontSize=".8rem">
              H3
            </Text>
          </IconButton>
        </Tooltip>

        <ToolbarSeparator />

        {/* List buttons */}
        <Tooltip content="Bulleted List">
          <IconButton
            data-active={blockType === "bullet" || undefined}
            variant="ghost"
            aria-label="Bulleted List"
            size="xs"
            onClick={() => formatList("bullet")}
          >
            <List size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Numbered List">
          <IconButton
            data-active={blockType === "number" || undefined}
            variant="ghost"
            aria-label="Numbered List"
            size="xs"
            onClick={() => formatList("number")}
          >
            <ListOrdered size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Check List">
          <IconButton
            data-active={blockType === "check" || undefined}
            variant="ghost"
            aria-label="Check List"
            size="xs"
            onClick={() => formatList("check")}
          >
            <ListTodo size={14} />
          </IconButton>
        </Tooltip>
      </Stack>
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
