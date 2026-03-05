import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { linkProject } from "./link-project";

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

describe("linkProject", () => {
  test("scaffolds docs when not present locally", async () => {
    mockFetchSequence([
      {
        status: 200,
        body: {
          id: "abc",
          name: "Existing",
          shorthand: "E",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
      { status: 201, body: { id: "repo-1", name: "link-scaffold", path: "/tmp/link-scaffold" } },
      { status: 200, body: [{ agent_id: "opencode", is_default: true }] },
    ]);
    const root = setup("link-scaffold");

    const fakeHome = join(tmpBase, "__fake-home__");
    const project = await linkProject(root, "abc", { homedir: fakeHome });

    expect(project).toEqual({
      id: "abc",
      name: "Existing",
      shorthand: "E",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("abc");

    expect(existsSync(join(root, ".pstdio", "docs", "navigation.json"))).toBe(true);
    expect(existsSync(join(root, ".pstdio", "docs", "index.md"))).toBe(true);

    expect(existsSync(join(root, ".opencode", "skills", "create-ticket", "SKILL.md"))).toBe(true);
  });

  test("skips scaffold when docs already exist locally", async () => {
    mockFetchSequence([
      {
        status: 200,
        body: {
          id: "abc",
          name: "Existing",
          shorthand: "E",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
      { status: 201, body: { id: "repo-1", name: "link-existing-docs", path: "/tmp/link-existing-docs" } },
      { status: 200, body: [] },
    ]);
    const root = setup("link-existing-docs");

    const docsDir = join(root, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "local.md"), "local content");

    await linkProject(root, "abc", { homedir: join(tmpBase, "__fake-home__") });

    expect(readFileSync(join(docsDir, "local.md"), "utf8")).toBe("local content");
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test("throws when project not found", async () => {
    mockFetchSequence([{ status: 404, body: { error: "Not found" } }]);
    const root = setup("link-404");

    expect(linkProject(root, "missing")).rejects.toThrow("Project not found: missing");
  });
});
