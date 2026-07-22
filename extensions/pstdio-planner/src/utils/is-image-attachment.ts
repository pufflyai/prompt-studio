// Image attachments drive the read-only preview path instead of the editor. The
// uploaded mime type is authoritative; the extension fallback only covers uploads
// that arrived without a usable type. File-kind-aware sidenav icons are out of scope.
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

interface ImageAttachmentInput {
  name: string;
  mimeType?: string | null;
}

export const isImageAttachment = ({ name, mimeType }: ImageAttachmentInput) => {
  if (mimeType?.startsWith("image/")) return true;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(extension);
};
