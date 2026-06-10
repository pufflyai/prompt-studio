import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";

// btoa expects a binary string (one char per byte). Build it byte-by-byte so a
// large image never blows the call stack the way String.fromCharCode(...bytes) would.
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// Encodes an attachment's bytes as a data URL the host renders directly: the
// attachment's host/blob URL isn't loadable across origins.
export const attachmentDataUrl = async (
  storage: ExtensionStorageApi,
  attachment: { id: string; mimeType: string | null },
) => {
  const bytes = await storage.files.getBytes(attachment.id);
  const mimeType = attachment.mimeType ?? "application/octet-stream";
  return { mimeType, dataUrl: `data:${mimeType};base64,${toBase64(bytes)}` };
};
