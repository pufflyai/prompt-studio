import { Box, Button, HStack, IconButton, Image, Text } from "@chakra-ui/react";
import { PaperclipIcon, XIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { SessionAttachmentRef } from "../session-attachment-ref";
import { appendDraftAttachments, clearDraftAttachments, removeDraftAttachment } from "./session-chat-attachments-state";
import { uploadSessionChatAttachments } from "./session-chat-attachments-upload";

export type UploadedSessionAttachment = SessionAttachmentRef;

export type SessionChatDraftAttachment = {
  upload: UploadedSessionAttachment;
  previewUrl: string;
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== "string") {
        reject(new Error(`Failed to load ${file.name}`));
        return;
      }
      const commaIndex = value.indexOf(",");
      resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
    };
    reader.onerror = () => reject(new Error(`Failed to load ${file.name}`));
    reader.readAsDataURL(file);
  });

export const useSessionChatAttachments = (projectId?: string) => {
  const [draftAttachments, setDraftAttachments] = useState<SessionChatDraftAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const attachmentsRef = useRef<SessionChatDraftAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    attachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useEffect(
    () => () => {
      clearDraftAttachments(attachmentsRef.current, URL.revokeObjectURL);
    },
    [],
  );

  const removeAttachment = (attachmentId: string) => {
    setDraftAttachments((current) => removeDraftAttachment(current, attachmentId, URL.revokeObjectURL));
  };

  const clearAllDraftAttachments = () => {
    setDraftAttachments((current) => clearDraftAttachments(current, URL.revokeObjectURL));
    setUploadError(null);
  };

  const handleSelectAttachments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !projectId) return;

    const candidates = await Promise.all(
      Array.from(files).map(async (file) => ({
        file,
        base64: await readFileAsBase64(file),
      })),
    );

    const result = await uploadSessionChatAttachments(projectId, candidates, {
      uploadAttachment: ({ projectId, fileName, mimeType, contentBase64 }) =>
        apiRequest<UploadedSessionAttachment>("/v1/sessions/attachments", {
          method: "POST",
          body: {
            project_id: projectId,
            file_name: fileName,
            mime_type: mimeType,
            content_base64: contentBase64,
          },
        }),
      createPreviewUrl: (file) => URL.createObjectURL(file),
    });

    setDraftAttachments((current) => appendDraftAttachments(current, result.uploaded));
    setUploadError(
      result.failed.length > 0
        ? `Failed to upload ${result.failed.length} file${result.failed.length === 1 ? "" : "s"}.`
        : null,
    );
    event.target.value = "";
  };

  const attachmentList =
    draftAttachments.length > 0 || uploadError ? (
      <Box>
        {draftAttachments.length > 0 ? (
          <HStack gap="2xs" py="2xs" flexWrap="wrap">
            {draftAttachments.map((attachment) => (
              <Box
                key={attachment.upload.id}
                position="relative"
                borderWidth="1px"
                borderColor="border.muted"
                borderRadius="xs"
              >
                <Image
                  src={attachment.previewUrl}
                  alt={attachment.upload.file_name}
                  boxSize="3rem"
                  objectFit="cover"
                  borderRadius="xs"
                />
                <IconButton
                  aria-label={`Remove ${attachment.upload.file_name}`}
                  size="2xs"
                  variant="solid"
                  position="absolute"
                  top="1"
                  right="1"
                  onClick={() => removeAttachment(attachment.upload.id)}
                >
                  <XIcon size={12} />
                </IconButton>
              </Box>
            ))}
          </HStack>
        ) : null}
        {uploadError ? (
          <Text py="2xs" fontSize="xs" color="fg.error">
            {uploadError}
          </Text>
        ) : null}
      </Box>
    ) : undefined;

  const attachmentActions = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={handleSelectAttachments}
      />
      <Button size="xs" variant="ghost" onClick={() => fileInputRef.current?.click()}>
        <PaperclipIcon size={14} />
        Attach image
      </Button>
    </>
  );

  return {
    draftAttachments,
    attachmentList,
    attachmentActions,
    clearAllDraftAttachments,
  };
};
