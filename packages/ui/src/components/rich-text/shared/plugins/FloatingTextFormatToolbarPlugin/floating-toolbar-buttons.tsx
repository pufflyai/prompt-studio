import { IconButton, Stack, Text } from "@chakra-ui/react";
import { FORMAT_TEXT_COMMAND, type LexicalEditor } from "lexical";
import { Code2, Link as LinkIcon, List, ListOrdered, ListTodo } from "lucide-react";
import { Tooltip } from "../../../../tooltip";
import type { BlockType } from "./resolve-block-type";

interface FloatingToolbarButtonsProps {
  editor: LexicalEditor;
  blockType: BlockType;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isLink: boolean;
  formatHeading: (headingSize: "h1" | "h2" | "h3") => void;
  formatList: (type: "bullet" | "number" | "check") => void;
  formatCodeBlock: () => void;
  insertLink: () => void;
}

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

export function FloatingToolbarButtons(props: FloatingToolbarButtonsProps) {
  const {
    editor,
    blockType,
    isBold,
    isItalic,
    isUnderline,
    isLink,
    formatHeading,
    formatList,
    formatCodeBlock,
    insertLink,
  } = props;

  return (
    <Stack direction="row" gap="0.5" alignItems="center">
      <Tooltip content="Bold">
        <IconButton
          data-active={isBold || undefined}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
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
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
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
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
          variant="ghost"
          aria-label="Underline"
          size="xs"
        >
          <Text textDecoration="underline" fontSize=".75rem">
            U
          </Text>
        </IconButton>
      </Tooltip>
      <Tooltip content={isLink ? "Remove Link" : "Insert Link"}>
        <IconButton
          data-active={isLink || undefined}
          variant="ghost"
          aria-label={isLink ? "Remove Link" : "Insert Link"}
          size="xs"
          onClick={insertLink}
        >
          <LinkIcon size={14} />
        </IconButton>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Heading 1">
        <IconButton
          data-active={blockType === "h1" || undefined}
          variant="ghost"
          aria-label="Heading 1"
          size="xs"
          onClick={() => formatHeading("h1")}
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
          onClick={() => formatHeading("h2")}
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
          onClick={() => formatHeading("h3")}
        >
          <Text fontWeight="thin" fontSize=".8rem">
            H3
          </Text>
        </IconButton>
      </Tooltip>

      <ToolbarSeparator />

      <Tooltip content="Code Block">
        <IconButton
          data-active={blockType === "code" || undefined}
          variant="ghost"
          aria-label="Code Block"
          size="xs"
          onClick={formatCodeBlock}
        >
          <Code2 size={14} />
        </IconButton>
      </Tooltip>

      <ToolbarSeparator />

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
  );
}
