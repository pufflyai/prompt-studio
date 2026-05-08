import { sanitizeUrl } from "./url";

export function openLinkUrl(url: string) {
  window.open(sanitizeUrl(url), "_blank", "noopener,noreferrer");
}
