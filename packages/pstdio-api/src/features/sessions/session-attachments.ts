import { readFileSync } from "node:fs";
import type { SessionPromptAttachment } from "pstdio-api-contracts";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_PROMPT = 4;
const BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const hasPngSignature = (data: Buffer) => PNG_SIGNATURE.every((byte, index) => data[index] === byte);

const hasJpegSignature = (data: Buffer) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

const hasWebpSignature = (data: Buffer) => {
  if (data.length < 12) return false;
  return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
};

const detectImageMimeType = (data: Buffer) => {
  if (hasPngSignature(data)) return "image/png";
  if (hasJpegSignature(data)) return "image/jpeg";
  if (hasWebpSignature(data)) return "image/webp";
  return null;
};

export const normalizeAttachmentMimeType = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

const assertValidAttachmentCount = (attachments: SessionPromptAttachment[]) => {
  if (attachments.length > MAX_ATTACHMENTS_PER_PROMPT) {
    throw new Error(`A prompt can include at most ${MAX_ATTACHMENTS_PER_PROMPT} image attachments.`);
  }
};

const assertValidImageMetadata = (mimeType: string, sizeBytes: number) => {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("Only PNG, JPEG, and WebP images are supported.");
  }

  if (sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(`Image attachments must be <= ${MAX_ATTACHMENT_SIZE_BYTES} bytes.`);
  }
};

export type ResolvedPromptAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  data: string;
  url: string;
};

export const resolvePromptAttachments = async (
  input: {
    projectId: string;
    attachments?: SessionPromptAttachment[];
  },
  deps: {
    fileService: {
      get: (fileId: string) => Promise<{
        id: string;
        project_id: string;
        file_name: string;
        file_kind: string;
        mime_type: string | null;
        size_bytes: number;
        storage_path: string;
      } | null>;
    };
  },
) => {
  const attachments = input.attachments ?? [];
  assertValidAttachmentCount(attachments);

  if (attachments.length === 0) return [];

  const resolved: ResolvedPromptAttachment[] = [];

  for (const attachment of attachments) {
    const file = await deps.fileService.get(attachment.id);
    if (!file || file.project_id !== input.projectId || file.file_kind !== "session_attachment") {
      throw new Error(`Attachment not found: ${attachment.id}`);
    }

    const mimeType = normalizeAttachmentMimeType(file.mime_type);
    assertValidImageMetadata(mimeType, file.size_bytes);

    let data: Buffer;
    try {
      data = readFileSync(file.storage_path);
    } catch {
      throw new Error(`Attachment not found: ${attachment.id}`);
    }

    resolved.push({
      id: file.id,
      filename: file.file_name,
      mimeType,
      byteSize: file.size_bytes,
      data: data.toString("base64"),
      url: `/v1/sessions/attachments/${file.id}/content?project_id=${encodeURIComponent(file.project_id)}`,
    });
  }

  return resolved;
};

export const sessionAttachmentLimits = {
  maxAttachmentsPerPrompt: MAX_ATTACHMENTS_PER_PROMPT,
  maxAttachmentSizeBytes: MAX_ATTACHMENT_SIZE_BYTES,
  allowedMimeTypes: [...ALLOWED_IMAGE_MIME_TYPES],
};

export const assertValidUploadMetadata = (mimeTypeInput: string | null | undefined, sizeBytes: number) => {
  const mimeType = normalizeAttachmentMimeType(mimeTypeInput);
  assertValidImageMetadata(mimeType, sizeBytes);
  return mimeType;
};

export const decodeAttachmentBase64 = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length % 4 !== 0 || !BASE64_BODY_PATTERN.test(trimmed)) {
    throw new Error("Invalid base64 image payload.");
  }

  const data = Buffer.from(trimmed, "base64");
  const normalizedInput = trimmed.replace(/=+$/, "");
  const normalizedDecoded = data.toString("base64").replace(/=+$/, "");

  if (normalizedDecoded !== normalizedInput) {
    throw new Error("Invalid base64 image payload.");
  }

  return data;
};

export const assertImageDataMatchesMimeType = (mimeType: string, data: Buffer) => {
  const detected = detectImageMimeType(data);
  if (!detected || detected !== mimeType) {
    throw new Error("Image bytes do not match declared MIME type.");
  }
};
