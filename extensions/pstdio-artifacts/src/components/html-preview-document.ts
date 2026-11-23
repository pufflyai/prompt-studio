import { webviewKeyboardRelayDocument } from "@pstdio/sdk/extensions";
import { previewThemeDocument, previewThemeRelayDocument } from "./html-preview-theme";

export const artifactPreviewPolicy = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src data:",
  "media-src data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const attribute = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const navigatePreviewFragments = () => {
  const resolveFragment = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    const link = event
      .composedPath()
      .find((node): node is Element => node instanceof Element && node.matches("a[href], area[href]"));
    const href = link?.getAttribute("href") ?? "";
    const fragment = href.trim();
    if (!link || !fragment.startsWith("#") || link.hasAttribute("download")) return;

    const target = link.getAttribute("target") || document.querySelector("base[target]")?.getAttribute("target");
    if (target && target.toLowerCase() !== "_self") return;

    // A bare fragment in srcdoc resolves against the embedding page's URL.
    // Let the browser follow the corrected link so author handlers can cancel it.
    const destination = `about:srcdoc${fragment}`;
    link.setAttribute("href", destination);
    setTimeout(() => {
      if (link.getAttribute("href") === destination) link.setAttribute("href", href);
    });
  };
  window.addEventListener("click", resolveFragment, { capture: true });
};

export const previewFragmentDocument = `<script>(${navigatePreviewFragments.toString()})()</script>`;

export const previewDocument = (html: string) => {
  const content = `<!doctype html><meta name="referrer" content="no-referrer">${webviewKeyboardRelayDocument}${previewThemeDocument}${previewFragmentDocument}${html}`;
  // Navigation is governed by the embedding document's frame-src policy. Keep that
  // document separate from artifact scripts, which run only in its opaque child.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${artifactPreviewPolicy}">
<meta name="referrer" content="no-referrer">
<style>html,body{height:100%;margin:0}iframe{display:block;width:100%;height:100%;border:0}</style>
${previewThemeRelayDocument}
${webviewKeyboardRelayDocument}
<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${attribute(content)}"></iframe>`;
};
