import { previewThemeDocument, previewThemeRelayDocument } from "./html-preview-theme";

const policy = [
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

export const previewDocument = (html: string) => {
  const content = `<!doctype html><meta name="referrer" content="no-referrer">${previewThemeDocument}${html}`;
  // Navigation is governed by the embedding document's frame-src policy. Keep that
  // document separate from artifact scripts, which run only in its opaque child.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="referrer" content="no-referrer">
<style>html,body{height:100%;margin:0}iframe{display:block;width:100%;height:100%;border:0}</style>
${previewThemeRelayDocument}
<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${attribute(content)}"></iframe>`;
};
