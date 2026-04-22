import { IconButton, Stack, Text } from "@chakra-ui/react";
import type { HeadingTagType } from "@lexical/rich-text";
import { FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { Code2, List, ListOrdered, ListTodo } from "lucide-react";
import type React from "react";
import { Tooltip } from "../../../../tooltip";
import type { BlockType } from "./resolve-block-type";

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

interface FloatingTextToolbarControlsProps {
  blockType: BlockType;
  editor: LexicalEditor;
  formatCodeBlock: () => void;
  formatHeading: (headingSize: HeadingTagType) => void;
  formatList: (type: "bullet" | "number" | "check") => void;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  preserveSelection: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function FloatingTextToolbarControls(props: FloatingTextToolbarControlsProps) {
  const {
    blockType,
    editor,
    formatCodeBlock,
    formatHeading,
    formatList,
    isBold,
    isItalic,
    isUnderline,
    preserveSelection,
  } = props;

  return (
    <Stack direction="row" gap="0.5" alignItems="center">
      <Tooltip content="Bold">
        <IconButton
          data-active={isBold || undefined}
          aria-pressed={isBold}
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
          }}
          onMouseDown={preserveSelection}
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
          aria-pressed={isItalic}
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
          }}
          onMouseDown={preserveSelection}
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
          aria-pressed={isUnderline}
          onClick={() => {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
          }}
          onMouseDown={preserveSelection}
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

      <Tooltip content="Heading 1">
        <IconButton
          data-active={blockType === "h1" || undefined}
          aria-pressed={blockType === "h1"}
          variant="ghost"
          aria-label="Heading 1"
          size="xs"
          onClick={() => {
            formatHeading("h1");
          }}
          onMouseDown={preserveSelection}
        >
          <Text fontWeight="thin" fontSize=".8rem">
            H1
          </Text>
        </IconButton>
      </Tooltip>
      <Tooltip content="Heading 2">
        <IconButton
          data-active={blockType === "h2" || undefined}
          aria-pressed={blockType === "h2"}
          variant="ghost"
          aria-label="Heading 2"
          size="xs"
          onClick={() => {
            formatHeading("h2");
          }}
          onMouseDown={preserveSelection}
        >
          <Text fontWeight="thin" fontSize=".8rem">
            H2
          </Text>
        </IconButton>
      </Tooltip>
      <Tooltip content="Heading 3">
        <IconButton
          data-active={blockType === "h3" || undefined}
          aria-pressed={blockType === "h3"}
          variant="ghost"
          aria-label="Heading 3"
          size="xs"
          onClick={() => {
            formatHeading("h3");
          }}
          onMouseDown={preserveSelection}
        >
          <Text fontWeight="thin" fontSize=".8rem">
            H3
          </Text>
        </IconButton>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Bulleted List">
        <IconButton
          data-active={blockType === "bullet" || undefined}
          aria-pressed={blockType === "bullet"}
          variant="ghost"
          aria-label="Bulleted List"
          size="xs"
          onClick={() => formatList("bullet")}
          onMouseDown={preserveSelection}
        >
          <List size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Numbered List">
        <IconButton
          data-active={blockType === "number" || undefined}
          aria-pressed={blockType === "number"}
          variant="ghost"
          aria-label="Numbered List"
          size="xs"
          onClick={() => formatList("number")}
          onMouseDown={preserveSelection}
        >
          <ListOrdered size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Check List">
        <IconButton
          data-active={blockType === "check" || undefined}
          aria-pressed={blockType === "check"}
          variant="ghost"
          aria-label="Check List"
          size="xs"
          onClick={() => formatList("check")}
          onMouseDown={preserveSelection}
        >
          <ListTodo size={14} />
        </IconButton>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Code Block">
        <IconButton
          data-active={blockType === "code" || undefined}
          aria-pressed={blockType === "code"}
          variant="ghost"
          aria-label="Code Block"
          size="xs"
          onClick={formatCodeBlock}
          onMouseDown={preserveSelection}
        >
          <Code2 size={14} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
