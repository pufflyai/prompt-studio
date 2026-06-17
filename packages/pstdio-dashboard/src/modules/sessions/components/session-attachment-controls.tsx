import { Box, IconButton } from "@chakra-ui/react";
import { ResourceBadge, Tooltip } from "@pstdio/ui";
import { ClipboardIcon, PaperclipIcon } from "lucide-react";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { ChangeEvent } from "react";
import { useRef } from "react";

interface SessionAttachmentControlsProps {
  projectId?: string;
  attachments: SessionAttachment[];
  uploading: boolean;
  onAttachFiles: (files: File[]) => void;
  onAttachText: (text: string) => void;
  onRemove: (fileId: string) => void;
}

export const SessionAttachmentControls = (props: SessionAttachmentControlsProps) => {
  const { projectId, attachments, uploading, onAttachFiles, onAttachText, onRemove } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = !projectId || uploading;

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    onAttachFiles(files);
  };

  const attachClipboardText = async () => {
    const text = await navigator.clipboard.readText();
    if (text.trim()) onAttachText(text);
  };

  return (
    <>
      <Box display="none">
        <input ref={inputRef} type="file" multiple onChange={handleFilesSelected} />
      </Box>
      <Tooltip content="Attach files">
        <IconButton
          aria-label="Attach files"
          size="2xs"
          variant="ghost"
          disabled={isDisabled}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon size={14} />
        </IconButton>
      </Tooltip>
      <Tooltip content="Attach clipboard text">
        <IconButton
          aria-label="Attach clipboard text"
          size="2xs"
          variant="ghost"
          disabled={isDisabled}
          onClick={() => void attachClipboardText()}
        >
          <ClipboardIcon size={14} />
        </IconButton>
      </Tooltip>
      {attachments.map((attachment) => (
        <ResourceBadge
          key={attachment.file_id}
          fileName={attachment.name}
          size="md"
          tone="neutral"
          onRemove={() => onRemove(attachment.file_id)}
        />
      ))}
    </>
  );
};
