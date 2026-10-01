import type { HarnessAttachment, SessionMessage } from "@pstdio/sdk/extensions";

export const promptWithAttachmentManifest = (prompt: string, attachments: HarnessAttachment[] = []) => {
  if (attachments.length === 0) return prompt;

  const lines = [
    prompt,
    "",
    "<session-attachments>",
    ...attachments.map(
      (attachment) =>
        `- name=${JSON.stringify(attachment.fileName)} path=${JSON.stringify(attachment.localPath)} mime=${JSON.stringify(
          attachment.mimeType,
        )} size=${attachment.sizeBytes}`,
    ),
    "</session-attachments>",
  ];

  return lines.join("\n");
};

export const userMessageFor = (prompt: string, attachments: HarnessAttachment[] = []): SessionMessage => {
  const createdAt = Date.now();
  return {
    id: `user-${createdAt}`,
    role: "user",
    createdAt,
    parts: [
      { type: "text", text: prompt },
      ...attachments.map((attachment) => ({
        type: "file" as const,
        fileId: attachment.fileId,
        filename: attachment.fileName,
        mediaType: attachment.mimeType ?? undefined,
        size: attachment.sizeBytes,
        url: attachment.url,
      })),
    ],
  };
};
