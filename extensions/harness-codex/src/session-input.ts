export interface StartSpawnInput {
  prompt: string;
  attachments?: HarnessAttachment[];
  model?: string | null;
  params?: Record<string, string | boolean>;
  cwd?: string;
  env?: Record<string, string>;
  events: HarnessEventSink;
  signal?: AbortSignal;
}
export interface ResumeSpawnInput extends StartSpawnInput {
  agentSessionId: string;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
}

import type { HarnessAttachment, HarnessEventSink, QuestionResponse, SessionMessage } from "@pstdio/sdk/extensions";

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
    id: `user-${crypto.randomUUID()}`,
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
