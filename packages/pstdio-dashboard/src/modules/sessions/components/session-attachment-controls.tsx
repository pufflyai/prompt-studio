import { Box, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { PaperclipIcon } from "lucide-react";
import { supportedSessionAttachmentAccept } from "pstdio-api-contracts/session-attachment-types";
import type { ChangeEvent } from "react";
import { useRef } from "react";

interface SessionAttachmentControlsProps {
  uploading: boolean;
  onAttachFiles: (files: File[]) => void;
}

export const SessionAttachmentControls = (props: SessionAttachmentControlsProps) => {
  const { uploading, onAttachFiles } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    onAttachFiles(files);
  };

  return (
    <>
      <Box display="none">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={supportedSessionAttachmentAccept}
          onChange={handleFilesSelected}
        />
      </Box>
      <Tooltip content="Attach files">
        <IconButton
          aria-label="Attach files"
          size="xs"
          variant="ghost"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon size={14} />
        </IconButton>
      </Tooltip>
    </>
  );
};
