import { Button, Dialog, IconButton, Image } from "@chakra-ui/react";
import type { ChatAttachment } from "@pstdio/sdk/extensions";
import { ResourceBadge } from "@pstdio/ui";
import { AttachmentList } from "@pstdio/ui/chat-ui";
import { X } from "lucide-react";
import { useState } from "react";

export const NativeChatAttachmentActions = (props: { disabled: boolean; upload(files: File[]): void }) => (
  <Button
    size="xs"
    variant="ghost"
    disabled={props.disabled}
    onClick={() => {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.multiple = true;
      picker.onchange = () => props.upload(Array.from(picker.files ?? []));
      picker.click();
    }}
  >
    Attach files
  </Button>
);

const isImage = (attachment: ChatAttachment) =>
  attachment.mediaType?.startsWith("image/") || /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(attachment.name);

export const NativeChatAttachmentList = (props: {
  attachments: ChatAttachment[];
  resolvedAttachments?: ChatAttachment[];
  disabled: boolean;
  remove(id: string): void;
}) => {
  const attachments = props.resolvedAttachments ?? props.attachments;
  const [previewId, setPreviewId] = useState<string>();
  const preview = attachments.find((attachment) => attachment.id === previewId);
  return (
    <>
      <AttachmentList
        attachments={attachments.map((attachment) => attachment.id)}
        renderBadge={({ attachmentId, size, tone }) => {
          const attachment = attachments.find((attachment) => attachment.id === attachmentId)!;
          return (
            <ResourceBadge
              fileName={attachment.name}
              size={size}
              tone={tone}
              icon={
                isImage(attachment) ? (
                  <Image
                    src={attachment.url}
                    alt={`${attachment.name} preview thumbnail`}
                    boxSize="18px"
                    borderRadius="xs"
                    objectFit="cover"
                  />
                ) : undefined
              }
              onSelect={isImage(attachment) ? () => setPreviewId(attachment.id) : undefined}
              onRemove={props.disabled ? undefined : () => props.remove(attachment.id)}
            />
          );
        }}
      />
      <Dialog.Root
        open={Boolean(preview)}
        onOpenChange={({ open }) => {
          if (!open) setPreviewId(undefined);
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="min(48rem, calc(100vw - 2rem))">
            <Dialog.Header>
              <Dialog.Title>{preview?.name}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label="Close preview" size="sm" variant="ghost">
                  <X size={16} />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p="md">
              {preview && (
                <Image
                  src={preview.url}
                  alt={`${preview.name} preview`}
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
