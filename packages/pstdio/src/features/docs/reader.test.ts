import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { flattenSidebar, loadDocsConfig, loadDocument } from "./reader";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const setup = (name: string) => {
  const dir = join(tmpBase, name, ".pstdio", "docs");
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("loadDocsConfig", () => {
  test("parses navigation.json sidebar", () => {
    const docsDir = setup("load-config");
    writeFileSync(
      join(docsDir, "navigation.json"),
      JSON.stringify({
        sidebar: [
          { text: "Intro", link: "/intro" },
          { text: "Guide", items: [{ text: "Setup", link: "/guide/setup" }] },
        ],
      }),
    );

    const config = loadDocsConfig(docsDir)!;

    expect(config.sidebar).toHaveLength(2);
    expect(config.sidebar[0].text).toBe("Intro");
    expect(config.sidebar[1].items).toHaveLength(1);
  });

  test("returns null when navigation.json missing", () => {
    const docsDir = setup("no-config");

    const config = loadDocsConfig(docsDir);

    expect(config).toBeNull();
  });
});

describe("flattenSidebar", () => {
  test("flattens nested sidebar into rows", () => {
    const items = [
      { text: "Intro", link: "/intro" },
      { text: "Guide", items: [{ text: "Setup", link: "/guide/setup" }] },
    ];

    const rows = flattenSidebar(items, new Set(["Guide"]));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ item: items[0], depth: 0, hasChildren: false });
    expect(rows[1].depth).toBe(0);
    expect(rows[1].hasChildren).toBe(true);
    expect(rows[2].depth).toBe(1);
  });

  test("hides children when parent not expanded", () => {
    const items = [{ text: "Guide", items: [{ text: "Setup", link: "/guide/setup" }] }];

    const rows = flattenSidebar(items, new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0].hasChildren).toBe(true);
  });
});

describe("loadDocument", () => {
  test("reads markdown file by sidebar link", () => {
    const docsDir = setup("load-doc");
    writeFileSync(join(docsDir, "intro.md"), "# Introduction\n\nWelcome.");

    const content = loadDocument(docsDir, "/intro");

    expect(content).toBe("# Introduction\n\nWelcome.");
  });

  test("returns null for missing file", () => {
    const docsDir = setup("missing-doc");

    const content = loadDocument(docsDir, "/nonexistent");

    expect(content).toBeNull();
  });
});
