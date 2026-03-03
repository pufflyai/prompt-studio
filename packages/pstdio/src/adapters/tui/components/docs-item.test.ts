import { describe, expect, test } from "bun:test";

import { buildDocsItemPrefix } from "./docs-item";

describe("buildDocsItemPrefix", () => {
  test("does not include a document icon for linked pages", () => {
    const prefix = buildDocsItemPrefix({
      row: { item: { text: "Intro", link: "/intro" }, depth: 0, hasChildren: false },
      isExpanded: false,
      isSelected: false,
    });

    expect(prefix).not.toContain("📄");
    expect(prefix).not.toContain("📁");
  });

  test("does not include a folder icon for groups", () => {
    const prefix = buildDocsItemPrefix({
      row: { item: { text: "Guide", items: [{ text: "Setup", link: "/guide/setup" }] }, depth: 1, hasChildren: true },
      isExpanded: true,
      isSelected: true,
    });

    expect(prefix).not.toContain("📄");
    expect(prefix).not.toContain("📁");
  });
});
