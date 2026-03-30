import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocsStorageService } from "./docs";

const validNavigation = JSON.stringify(
  { sidebar: [{ text: "Guide", items: [{ text: "Getting Started", link: "/guide/getting-started" }] }] },
  null,
  2,
);

const createFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-docs-service-"));
  const docsDir = join(root, ".pstdio", "docs");
  mkdirSync(join(docsDir, "guide"), { recursive: true });
  writeFileSync(join(docsDir, "navigation.json"), validNavigation, "utf8");
  writeFileSync(join(docsDir, "guide", "getting-started.md"), "# Getting Started\n\nHello world.\n", "utf8");

  const docs = createDocsStorageService();

  return { root, docsDir, docs };
};

test("getIndex reads navigation.json from repo and returns parsed sidebar", () => {
  const fixture = createFixture();
  try {
    const index = fixture.docs.getIndex(fixture.root);
    expect(index.sidebar).toEqual([
      { text: "Guide", items: [{ text: "Getting Started", link: "/guide/getting-started", items: undefined }] },
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getDocument resolves link and returns markdown content", () => {
  const fixture = createFixture();
  try {
    const doc = fixture.docs.getDocument(fixture.root, "/guide/getting-started");
    expect(doc.path).toBe("guide/getting-started.md");
    expect(doc.content).toContain("Hello world.");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex throws when navigation.json is missing", () => {
  const fixture = createFixture();
  try {
    rmSync(join(fixture.docsDir, "navigation.json"));
    expect(() => fixture.docs.getIndex(fixture.root)).toThrow("navigation.json");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex throws when navigation.json is invalid JSON", () => {
  const fixture = createFixture();
  try {
    writeFileSync(join(fixture.docsDir, "navigation.json"), "{invalid", "utf8");
    expect(() => fixture.docs.getIndex(fixture.root)).toThrow("Unable to parse");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex returns missingLinks when sidebar link points to missing file", () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(fixture.docsDir, "navigation.json"),
      JSON.stringify({
        sidebar: [
          { text: "Exists", link: "/guide/getting-started" },
          { text: "Missing", link: "/nowhere" },
        ],
      }),
      "utf8",
    );
    const index = fixture.docs.getIndex(fixture.root);
    expect(index.sidebar).toHaveLength(2);
    expect(index.missingLinks).toEqual(["/nowhere"]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex returns empty missingLinks when all links exist", () => {
  const fixture = createFixture();
  try {
    const index = fixture.docs.getIndex(fixture.root);
    expect(index.missingLinks).toEqual([]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex preserves template metadata on sidebar items", () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(fixture.docsDir, "navigation.json"),
      JSON.stringify({
        sidebar: [
          {
            text: "Release notes",
            link: "/guide/getting-started",
            template: "changelog",
          },
        ],
      }),
      "utf8",
    );

    const index = fixture.docs.getIndex(fixture.root);
    expect(index.sidebar).toEqual([
      {
        text: "Release notes",
        link: "/guide/getting-started",
        template: "changelog",
        items: undefined,
      },
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getDocument throws when document does not exist", () => {
  const fixture = createFixture();
  try {
    expect(() => fixture.docs.getDocument(fixture.root, "/nonexistent")).toThrow("not found");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex rejects path traversal in sidebar links", () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(fixture.docsDir, "navigation.json"),
      JSON.stringify({ sidebar: [{ text: "Escape", link: "../../secret" }] }),
      "utf8",
    );
    expect(() => fixture.docs.getIndex(fixture.root)).toThrow("outside .pstdio/docs");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
