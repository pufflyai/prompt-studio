import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scaffoldDocs } from "./scaffold";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("scaffoldDocs", () => {
  test("creates navigation.json and index.md", async () => {
    const root = setup("scaffold-docs");

    await scaffoldDocs(root);

    const docsDir = join(root, ".pstdio", "docs");
    expect(existsSync(join(docsDir, "navigation.json"))).toBe(true);
    expect(existsSync(join(docsDir, "index.md"))).toBe(true);
  });

  test("does not overwrite existing docs", async () => {
    const root = setup("scaffold-no-overwrite");
    const docsDir = join(root, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "navigation.json"), "existing");

    await scaffoldDocs(root);

    const raw = readFileSync(join(docsDir, "navigation.json"), "utf8");
    expect(raw).toBe("existing");
  });
});
