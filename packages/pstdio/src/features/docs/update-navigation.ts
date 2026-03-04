import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DocsConfig, SidebarItem } from "./types";

export const addToNavigation = (docsDir: string, docPath: string, text: string) => {
  const configPath = join(docsDir, "navigation.json");
  const config: DocsConfig = JSON.parse(readFileSync(configPath, "utf8"));

  const parts = docPath.split("/");
  const link = `/${docPath}`;

  // Walk/create nested sidebar groups based on path segments
  let items = config.sidebar;
  for (let i = 0; i < parts.length - 1; i++) {
    const groupText = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
    let group = items.find((item) => item.text.toLowerCase() === groupText.toLowerCase());

    if (!group) {
      group = { text: groupText, items: [] };
      items.push(group);
    }

    if (!group.items) {
      group.items = [];
    }

    items = group.items;
  }

  // Check if entry already exists
  const exists = items.some((item) => item.link === link);
  if (!exists) {
    items.push({ text, link } satisfies SidebarItem);
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
};
