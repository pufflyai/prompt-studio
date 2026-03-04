import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createAndInitProject } from "./create-and-init";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const originalFetch = globalThis.fetch;

const templateResponse = { status: 201, body: { id: "tpl", name: "t", template_type: "docs", is_default: false } };
const seedTemplateResponses = Array.from({ length: 6 }, () => templateResponse);

const mockFetchSequence = (responses: { status: number; body: unknown }[]) => {
  let callIndex = 0;
  globalThis.fetch = mock(() => {
    const resp = responses[callIndex++];
    if (!resp) return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify(resp.body), { status: resp.status }));
  }) as unknown as typeof fetch;
};

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("createAndInitProject", () => {
  test("creates project via API, registers repo, writes config, scaffolds docs, installs skills", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-1", name: "Test" } },
      { status: 201, body: { id: "repo-1", name: "create-init", path: "/tmp/create-init" } },
      ...seedTemplateResponses,
      { status: 200, body: [{ agent_id: "opencode", is_default: true }] },
    ]);
    const root = setup("create-init");

    const fakeHome = join(tmpBase, "__fake-home__");
    const project = await createAndInitProject(root, "Test", { homedir: fakeHome });

    expect(project).toEqual({ id: "proj-1", name: "Test" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(9);

    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("proj-1");

    expect(existsSync(join(root, ".pstdio", "docs", "navigation.json"))).toBe(true);
    expect(existsSync(join(root, ".pstdio", "docs", "index.md"))).toBe(true);

    expect(existsSync(join(root, ".opencode", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".opencode", "skills", "implement-ticket", "SKILL.md"))).toBe(true);
  });

  test("throws when .pstdio/config.json already exists", async () => {
    mockFetchSequence([{ status: 201, body: { id: "proj-2", name: "Duplicate" } }]);
    const root = setup("already-init");

    const configDir = join(root, ".pstdio");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), '{"project_id":"existing"}');

    expect(createAndInitProject(root, "Duplicate")).rejects.toThrow("already initialized");
  });

  test("does not scaffold docs when .pstdio/docs already exists", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-3", name: "HasDocs" } },
      { status: 201, body: { id: "repo-3", name: "has-docs", path: "/tmp/has-docs" } },
      ...seedTemplateResponses,
      { status: 200, body: [] },
    ]);
    const root = setup("has-docs");

    const docsDir = join(root, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "my-doc.md"), "existing doc");

    const project = await createAndInitProject(root, "HasDocs", { homedir: join(tmpBase, "__fake-home__") });
    expect(project).toEqual({ id: "proj-3", name: "HasDocs" });

    // Should NOT have added starter files
    expect(existsSync(join(docsDir, "navigation.json"))).toBe(false);
    expect(existsSync(join(docsDir, "index.md"))).toBe(false);
    // Existing doc untouched
    expect(readFileSync(join(docsDir, "my-doc.md"), "utf8")).toBe("existing doc");
  });
});
