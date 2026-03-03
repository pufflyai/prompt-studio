import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDocsService } from "./docs";

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

  const reposService = {
    listByProject: async (_projectId: string) => [{ path: root, id: "repo-1", name: "test-repo" }],
  };

  const docs = createDocsService(reposService as any);

  return { root, docsDir, docs };
};

test("getIndex reads navigation.json from repo and returns parsed sidebar", async () => {
  const fixture = createFixture();
  try {
    const index = await fixture.docs.getIndex("project-1");
    expect(index.sidebar).toEqual([
      { text: "Guide", items: [{ text: "Getting Started", link: "/guide/getting-started", items: undefined }] },
    ]);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getDocument resolves link and returns markdown content", async () => {
  const fixture = createFixture();
  try {
    const doc = await fixture.docs.getDocument("project-1", "/guide/getting-started");
    expect(doc.path).toBe("guide/getting-started.md");
    expect(doc.content).toContain("Hello world.");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex throws when navigation.json is missing", async () => {
  const fixture = createFixture();
  try {
    rmSync(join(fixture.docsDir, "navigation.json"));
    expect(fixture.docs.getIndex("project-1")).rejects.toThrow("navigation.json");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex throws when navigation.json is invalid JSON", async () => {
  const fixture = createFixture();
  try {
    writeFileSync(join(fixture.docsDir, "navigation.json"), "{invalid", "utf8");
    expect(fixture.docs.getIndex("project-1")).rejects.toThrow("Unable to parse");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex throws when sidebar link points to missing file", async () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(fixture.docsDir, "navigation.json"),
      JSON.stringify({ sidebar: [{ text: "Missing", link: "/nowhere" }] }),
      "utf8",
    );
    expect(fixture.docs.getIndex("project-1")).rejects.toThrow("not found");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getDocument throws when document does not exist", async () => {
  const fixture = createFixture();
  try {
    expect(fixture.docs.getDocument("project-1", "/nonexistent")).rejects.toThrow("not found");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("getIndex rejects path traversal in sidebar links", async () => {
  const fixture = createFixture();
  try {
    writeFileSync(
      join(fixture.docsDir, "navigation.json"),
      JSON.stringify({ sidebar: [{ text: "Escape", link: "../../secret" }] }),
      "utf8",
    );
    expect(fixture.docs.getIndex("project-1")).rejects.toThrow("outside .pstdio/docs");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("throws when no repo is linked to the project", async () => {
  const reposService = { listByProject: async () => [] };
  const docs = createDocsService(reposService as any);
  expect(docs.getIndex("project-1")).rejects.toThrow("No repo linked");
});
