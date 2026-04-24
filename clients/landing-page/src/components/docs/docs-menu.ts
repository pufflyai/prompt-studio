import type { DocsPaginationItem, DocsSidebarItem } from "./docs-navigation";

export interface DocEntry {
  title: string;
  description: string;
  section: string;
  category?: string;
  categoryOrder?: number;
  order: number;
  url: string;
  outline?: DocOutlineItem[];
}

export interface DocOutlineItem {
  title: string;
  level: number;
  href: string;
}

export const docsOverviewEntry: DocEntry = {
  title: "Overview",
  description: "Learn how to plan work, launch coding agents, and review local agent attempts with Prompt Studio.",
  section: "Guide",
  order: 0,
  url: "/docs/",
};

export const normalizeDocsPath = (path: string) => {
  if (path === "/") return path;
  return path.replace(/\/$/, "");
};

export const buildDocsMenuItems = (docs: DocEntry[]): DocsSidebarItem[] => {
  const sectionOrder: string[] = [];
  const sections = new Map<string, DocEntry[]>();

  for (const doc of docs) {
    if (!sections.has(doc.section)) {
      sections.set(doc.section, []);
      sectionOrder.push(doc.section);
    }
    sections.get(doc.section)!.push(doc);
  }

  return sectionOrder.map((sectionName) => {
    const sectionDocs = sections.get(sectionName) ?? [];
    const categoryOrder: string[] = [];
    const categoryBuckets = new Map<string, DocEntry[]>();
    const rootDocs: DocEntry[] = [];

    for (const doc of sectionDocs) {
      if (!doc.category) {
        rootDocs.push(doc);
        continue;
      }

      if (!categoryBuckets.has(doc.category)) {
        categoryBuckets.set(doc.category, []);
        categoryOrder.push(doc.category);
      }
      categoryBuckets.get(doc.category)!.push(doc);
    }

    const items: DocsSidebarItem[] = [
      ...rootDocs.map((doc) => ({ text: doc.title, link: doc.url, description: doc.description })),
      ...categoryOrder.map((categoryName) => ({
        text: categoryName,
        items: (categoryBuckets.get(categoryName) ?? []).map((doc) => ({
          text: doc.title,
          link: doc.url,
          description: doc.description,
        })),
      })),
    ];

    return { text: sectionName, items };
  });
};

const compareDocs = (a: DocEntry, b: DocEntry) => {
  if (a.section !== b.section) return 0;

  const aCategoryOrder = a.category ? (a.categoryOrder ?? 1000) : -1;
  const bCategoryOrder = b.category ? (b.categoryOrder ?? 1000) : -1;
  if (aCategoryOrder !== bCategoryOrder) return aCategoryOrder - bCategoryOrder;

  return a.order - b.order;
};

export const sortDocs = (docs: DocEntry[]) => {
  const sectionOrder: string[] = [];
  const sectionBuckets = new Map<string, DocEntry[]>();

  for (const doc of docs) {
    if (!sectionBuckets.has(doc.section)) {
      sectionBuckets.set(doc.section, []);
      sectionOrder.push(doc.section);
    }
    sectionBuckets.get(doc.section)!.push(doc);
  }

  return sectionOrder.flatMap((section) => (sectionBuckets.get(section) ?? []).slice().sort(compareDocs));
};

export const getDocsPagination = (docs: DocEntry[], currentPath: string) => {
  const normalizedCurrentPath = normalizeDocsPath(currentPath);
  const currentIndex = docs.findIndex((doc) => normalizeDocsPath(doc.url) === normalizedCurrentPath);
  const previousDoc = currentIndex > 0 ? docs[currentIndex - 1] : undefined;
  const nextDoc = currentIndex >= 0 && currentIndex < docs.length - 1 ? docs[currentIndex + 1] : undefined;

  const previous: DocsPaginationItem | undefined = previousDoc
    ? { href: previousDoc.url, title: previousDoc.title, description: previousDoc.description }
    : undefined;
  const next: DocsPaginationItem | undefined = nextDoc
    ? { href: nextDoc.url, title: nextDoc.title, description: nextDoc.description }
    : undefined;

  return { previous, next };
};
