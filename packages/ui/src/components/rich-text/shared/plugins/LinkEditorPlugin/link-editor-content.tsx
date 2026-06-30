import { Link as ChakraLink, IconButton, Input, Stack } from "@chakra-ui/react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type React from "react";
import { Tooltip } from "@/components/primitives/tooltip";

interface LinkEditorContentProps {
  isActive: boolean;
  isLinkEditMode: boolean;
  editedLinkUrl: string;
  editedLinkUrlIsValid: boolean;
  linkUrl: string;
  href: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEditedLinkUrlChange: (url: string) => void;
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSubmit: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function LinkEditorContent(props: LinkEditorContentProps) {
  const {
    isActive,
    isLinkEditMode,
    editedLinkUrl,
    editedLinkUrlIsValid,
    linkUrl,
    href,
    inputRef,
    onEditedLinkUrlChange,
    onInputKeyDown,
    onClose,
    onSubmit,
    onEdit,
    onRemove,
  } = props;

  if (!isActive) {
    return null;
  }

  if (isLinkEditMode) {
    return (
      <Stack className="link-editor-content" direction="row" gap="1" alignItems="center" p="1">
        <Input
          ref={inputRef}
          className="link-editor-url-field"
          size="sm"
          fontSize="sm"
          value={editedLinkUrl}
          placeholder="https://"
          aria-label="Link URL"
          aria-invalid={!editedLinkUrlIsValid}
          onChange={(event) => {
            onEditedLinkUrlChange(event.target.value);
          }}
          onKeyDown={onInputKeyDown}
        />
        <Tooltip content="Cancel">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Cancel link edit"
            onMouseDown={preventFocusLoss}
            onClick={onClose}
          >
            <X size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Confirm">
          <IconButton
            variant="ghost"
            size="xs"
            aria-label="Confirm link edit"
            disabled={!editedLinkUrlIsValid}
            onMouseDown={preventFocusLoss}
            onClick={onSubmit}
          >
            <Check size={14} />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  }

  return (
    <Stack className="link-editor-content" direction="row" gap="1" alignItems="center" p="1">
      <ChakraLink
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="link-editor-url-field"
        fontSize="sm"
        textDecoration="underline"
        px="2"
        truncate
      >
        {linkUrl}
      </ChakraLink>
      <Tooltip content="Edit link">
        <IconButton variant="ghost" size="xs" aria-label="Edit link" onMouseDown={preventFocusLoss} onClick={onEdit}>
          <Pencil size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Remove link">
        <IconButton
          variant="ghost"
          size="xs"
          aria-label="Remove link"
          onMouseDown={preventFocusLoss}
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function preventFocusLoss(event: React.MouseEvent) {
  event.preventDefault();
}
