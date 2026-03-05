import type { DocsSidebarItem } from "./data/api";

export type DocsMenuEntry = {
  text: string;
  link: string;
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
    const current = item.link ? [{ text: label, link: item.link }] : [];
    const nested = item.items?.length ? flattenDocsSidebar(item.items, nextParents) : [];
    return [...current, ...nested];
  });

const matchesNormalizedLink = (item: DocsSidebarItem, normalizedLink: string): boolean => {
  if (item.link && normalizeDocsLink(item.link) === normalizedLink) {
    return true;
  }

  return item.items?.some((nestedItem) => matchesNormalizedLink(nestedItem, normalizedLink)) ?? false;
};

export const sidebarItemContainsLink = (item: DocsSidebarItem, link: string | null) => {
  if (!link) {
    return false;
  }

  const normalizedLink = normalizeDocsLink(link);
  if (!normalizedLink) {
    return false;
  }

  return matchesNormalizedLink(item, normalizedLink);
};

export const resolveActiveDocLink = (routeDoc: unknown, entries: DocsMenuEntry[]) => {
  const selected = typeof routeDoc === "string" ? normalizeDocsLink(routeDoc) : null;

  if (selected) {
    const matched = entries.find((entry) => normalizeDocsLink(entry.link) === selected);
    if (matched) {
      return matched.link;
    }
  }

  return entries[0]?.link ?? null;
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
