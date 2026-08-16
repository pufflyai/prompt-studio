export type MarkdownUrlKind = "link" | "image";

export type MarkdownUrlResolver = (source: string, kind: MarkdownUrlKind) => string | null;

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "sms:", "tel:"]);
const SAFE_IMAGE_DATA_URL = /^data:image\/(?:png|gif|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const PROTOCOL = /^[a-z][a-z\d+.-]*:/i;

const hasSafeLinkProtocol = (source: string) => {
  if (source.startsWith("#") || source.startsWith("/") || source.startsWith("./") || source.startsWith("../")) {
    return true;
  }

  if (!PROTOCOL.test(source)) return true;

  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(source).protocol);
  } catch {
    return false;
  }
};

const hasSafeImageProtocol = (source: string) => {
  if (source.startsWith("https://")) return true;
  return SAFE_IMAGE_DATA_URL.test(source);
};

export const resolveMarkdownUrl = (source: string, kind: MarkdownUrlKind, resolver?: MarkdownUrlResolver) => {
  const resolved = resolver ? resolver(source, kind) : source;
  if (resolved === null) return null;

  if (kind === "image") {
    const sourceIsRelative = !PROTOCOL.test(source);
    if (sourceIsRelative && !resolver) return null;
    return hasSafeImageProtocol(resolved) ? resolved : null;
  }

  return hasSafeLinkProtocol(resolved) ? resolved : null;
};
