import { webUrl } from "./web-url";

// Returns the icons a page declares before its <body>. Site icons come before touch icons, which are larger.
// HTMLRewriter parses in one pass and skips comments and scripts, so a hostile page cannot stall the runtime.
export const findPageIcons = (html: string, pageUrl: URL) => {
  const icons: URL[] = [];
  const touchIcons: URL[] = [];
  let inBody = false;
  new HTMLRewriter()
    .on("body", {
      element() {
        inBody = true;
      },
    })
    .on("link", {
      element(link) {
        const rel = link.getAttribute("rel")?.toLowerCase().split(/\s+/) ?? [];
        // HTMLRewriter keeps attribute values as written, and `&amp;` is the common entity in URLs.
        const url = webUrl(link.getAttribute("href")?.replaceAll("&amp;", "&").trim() ?? "", pageUrl.href);
        if (inBody || !url) return;
        if (rel.includes("icon")) icons.push(url);
        else if (rel.includes("apple-touch-icon")) touchIcons.push(url);
      },
    })
    .transform(html);
  return [...icons, ...touchIcons];
};
