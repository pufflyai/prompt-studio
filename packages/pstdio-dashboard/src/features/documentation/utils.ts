import type { DocsSidebarItem } from "./data/api";

export type DocsMenuEntry = {
  text: string;
  itemText: string;
  link: string;
  template?: string;
};

const DOCS_URL_BASE = "https://docs.local";

const normalizeDocsLink = (link: string) => {
  const raw = link.split("#")[0]?.split("?")[0]?.trim() ?? "";
  if (!raw) {
    return null;
  }

  const normalized = raw.replaceAll("\\", "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const compact = prefixed.replace(/\/+/g, "/");
  const withoutMarkdownExtension = compact.replace(/\.md$/i, "");
  const withoutTrailingSlash =
    withoutMarkdownExtension.length > 1 ? withoutMarkdownExtension.replace(/\/+$/g, "") : withoutMarkdownExtension;

  return withoutTrailingSlash === "/" ? "/index" : withoutTrailingSlash;
};

const toDocsMarkdownPath = (link: string | null) => {
  const normalized = normalizeDocsLink(link ?? "/index") ?? "/index";
  return `${normalized}.md`;
};

export const flattenDocsSidebar = (items: DocsSidebarItem[], parents: string[] = []): DocsMenuEntry[] =>
  items.flatMap((item) => {
    const nextParents = item.items?.length ? [...parents, item.text] : parents;
    const label = [...parents, item.text].join(" / ");
    const current = item.link ? [{ text: label, itemText: item.text, link: item.link, template: item.template }] : [];
    const nested = item.items?.length ? flattenDocsSidebar(item.items, nextParents) : [];
    return [...current, ...nested];
  });

export const resolveActiveDocEntry = (routeDoc: unknown, entries: DocsMenuEntry[]) => {
  const selected = typeof routeDoc === "string" ? normalizeDocsLink(routeDoc) : null;

  if (selected) {
    const matched = entries.find((entry) => normalizeDocsLink(entry.link) === selected);
    if (matched) {
      return matched;
    }
  }

  return entries[0] ?? null;
};

export const resolveDocsLinkFromHref = (href: string, currentLink: string | null) => {
  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith("#")) {
    return null;
  }

  if (trimmedHref.startsWith("//") || /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedHref)) {
    return null;
  }

  const basePath = toDocsMarkdownPath(currentLink);
  const resolvedPath = new URL(trimmedHref, `${DOCS_URL_BASE}${basePath}`).pathname;
  return normalizeDocsLink(resolvedPath);
};
