import type { DocEntry } from "./docs-menu";

export type DocsSearchItemKind = "category" | "page" | "outline";

export interface DocsSearchItem {
  id: string;
  title: string;
  href: string;
  description: string;
  group: string;
  kind: DocsSearchItemKind;
  searchText: string;
}

export interface DocsSearchGroup {
  title: string;
  items: DocsSearchItem[];
}

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm;

export const extractDocsOutlineItems = (markdown: string, pageUrl: string) => {
  const items: NonNullable<DocEntry["outline"]> = [];
  const seenIds = new Map<string, number>();

  for (const match of markdown.matchAll(HEADING_REGEX)) {
    const title = formatHeadingTitle(match[2] ?? "");
    const slug = slugifyHeading(title) || "heading";
    const seenCount = seenIds.get(slug) ?? 0;
    const headingId = seenCount === 0 ? slug : `${slug}-${seenCount}`;

    seenIds.set(slug, seenCount + 1);

    items.push({
      title,
      level: match[1]?.length ?? 1,
      href: `${pageUrl}${pageUrl.endsWith("/") ? "" : "/"}#${headingId}`,
    });
  }

  return items;
};

export const buildDocsSearchItems = (docs: DocEntry[]) => {
  const categoryItems = getDocsCategorySearchItems(docs);
  const contentItems = docs.flatMap((doc) => {
    const group = getDocsSearchGroup(doc);
    const pageItem: DocsSearchItem = {
      id: `page:${doc.url}`,
      title: doc.title,
      href: doc.url,
      description: doc.description,
      group,
      kind: "page",
      searchText: [doc.title, doc.description, group, doc.section].join(" "),
    };

    const outlineItems = (doc.outline ?? []).map((outline) => ({
      id: `outline:${outline.href}`,
      title: outline.title,
      href: outline.href,
      description: doc.title,
      group,
      kind: "outline" as const,
      searchText: [outline.title, doc.title].join(" "),
    }));

    return [pageItem, ...outlineItems];
  });

  return [...categoryItems, ...contentItems];
};

export const getDocsSearchGroups = (items: DocsSearchItem[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  const groups = new Map<string, DocsSearchItem[]>();

  if (!normalizedQuery) return [];

  for (const item of items) {
    if (!item.searchText.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    const groupItems = groups.get(item.group) ?? [];
    groupItems.push(item);
    groups.set(item.group, groupItems);
  }

  return Array.from(groups.entries()).map(([title, groupItems]) => ({
    title,
    items: groupItems,
  }));
};

const getDocsCategorySearchItems = (docs: DocEntry[]) => {
  const categories = new Map<string, DocsSearchItem>();

  for (const doc of docs) {
    const group = getDocsSearchGroup(doc);
    const key = `${doc.section}:${group}`;

    if (categories.has(key)) {
      continue;
    }

    const description = group === doc.section ? "Documentation section" : doc.section;

    categories.set(key, {
      id: `category:${slugifyHeading(key)}`,
      title: group,
      href: doc.url,
      description,
      group,
      kind: "category",
      searchText: [group, doc.section].join(" "),
    });
  }

  return Array.from(categories.values());
};

const getDocsSearchGroup = (doc: DocEntry) => {
  return doc.category ?? doc.section;
};

const formatHeadingTitle = (value: string) => {
  return value
    .replace(/\s+#+$/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim();
};

const slugifyHeading = (value: string) => {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/\s+/g, "-");
};
