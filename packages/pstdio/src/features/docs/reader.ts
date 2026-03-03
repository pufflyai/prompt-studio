import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DocRow, DocsConfig, SidebarItem } from "./types";

export const loadDocsConfig = (docsDir: string) => {
  const configPath = join(docsDir, "navigation.json");

  if (!existsSync(configPath)) {
    return null;
  }

  return JSON.parse(readFileSync(configPath, "utf8")) as DocsConfig;
};

export const flattenSidebar = (items: SidebarItem[], expanded: Set<string>, depth = 0): DocRow[] => {
  const rows: DocRow[] = [];

  for (const item of items) {
    const hasChildren = !!item.items?.length;
    rows.push({ item, depth, hasChildren });

    if (hasChildren && expanded.has(item.text)) {
      rows.push(...flattenSidebar(item.items!, expanded, depth + 1));
    }
  }

  return rows;
};

export const loadDocument = (docsDir: string, link: string) => {
  const normalized = link.replace(/^\//, "");
  const filePath = join(docsDir, `${normalized}.md`);

  if (!existsSync(filePath)) {
    return null;
  }

  return readFileSync(filePath, "utf8");
};
