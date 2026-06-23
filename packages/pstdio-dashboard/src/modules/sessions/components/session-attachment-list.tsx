import { Dialog, IconButton, Image, Stack } from "@chakra-ui/react";
import { ResourceBadge } from "@pstdio/ui";
import { X } from "lucide-react";
import type { SessionAttachment } from "pstdio-api-contracts";
import { useState } from "react";

interface SessionAttachmentListProps {
  attachments: SessionAttachment[];
  onRemove: (fileId: string) => void;
}

const imageExtensionPattern = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i;

const isImageAttachment = (attachment: SessionAttachment) =>
  attachment.mime_type?.startsWith("image/") || imageExtensionPattern.test(attachment.name);

export const SessionAttachmentList = (props: SessionAttachmentListProps) => {
  const { attachments, onRemove } = props;
  const [previewAttachment, setPreviewAttachment] = useState<SessionAttachment | null>(null);
  if (attachments.length === 0) return null;

  return (
    <>
      <Stack direction="row" gap="1" flexWrap="wrap" alignItems="center">
        {attachments.map((attachment) => {
          const isImage = isImageAttachment(attachment);
          return (
            <ResourceBadge
              key={attachment.file_id}
              fileName={attachment.name}
              size="md"
              tone="neutral"
              icon={
                isImage ? (
                  <Image
                    src={attachment.url}
                    alt={`${attachment.name} preview thumbnail`}
                    boxSize="18px"
                    borderRadius="xs"
                    objectFit="cover"
                  />
                ) : undefined
              }
              onSelect={isImage ? () => setPreviewAttachment(attachment) : undefined}
              onRemove={() => onRemove(attachment.file_id)}
            />
          );
        })}
      </Stack>
      <Dialog.Root
        open={Boolean(previewAttachment)}
        onOpenChange={(details) => {
          if (!details.open) setPreviewAttachment(null);
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="min(48rem, calc(100vw - 2rem))">
            <Dialog.Header>
              <Dialog.Title>{previewAttachment?.name}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label="Close preview" size="sm" variant="ghost">
                  <X size={16} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p="md">
              {previewAttachment && (
                <Image
                  src={previewAttachment.url}
                  alt={`${previewAttachment.name} preview`}
                  maxH="70vh"
                  maxW="100%"
                  mx="auto"
                  objectFit="contain"
                />
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
};
