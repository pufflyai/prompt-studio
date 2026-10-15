// Image attachments drive the read-only preview path instead of the editor. The
// uploaded mime type is authoritative; the extension fallback only covers uploads
// that arrived without a usable type. File-kind-aware sidenav icons are out of scope.
const IMAGE_MIME_TYPES = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["svg", "image/svg+xml"],
]);

interface ImageAttachmentInput {
  name: string;
  mimeType?: string | null;
}

export const imageMimeType = (name: string) => IMAGE_MIME_TYPES.get(name.split(".").pop()?.toLowerCase() ?? "") ?? null;

export const imageExtensionForMimeType = (mimeType?: string | null) =>
  [...IMAGE_MIME_TYPES].find(([, type]) => type === mimeType)?.[0] ?? null;

export const isImageAttachment = ({ name, mimeType }: ImageAttachmentInput) =>
  Boolean(mimeType?.startsWith("image/") || imageMimeType(name));
