import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { createAndInitProject } from "./create-and-init";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const templateResponse = { status: 201, body: { id: "tpl", name: "t", template_type: "document", is_default: false } };
const seedTemplateResponses = Array.from({ length: 6 }, () => templateResponse);

const skillFixture = (name: string) => ({
  id: `id-${name}`,
  project_id: "proj-1",
  name,
  description: `${name} desc`,
  file_id: `file-${name}`,
  content: `---\nname: ${name}\n---\n${name} content`,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const SKILL_NAMES = ["create-ticket", "implement-ticket"];
const skillListResponse = { status: 200, body: SKILL_NAMES.map(skillFixture) };
const skillGetResponses = SKILL_NAMES.map((name) => ({ status: 200, body: skillFixture(name) }));

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

describe("createAndInitProject", () => {
  test("creates project via API, registers repo, writes config, scaffolds docs, installs skills", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-1", name: "Test" } },
      { status: 201, body: { id: "repo-1", name: "create-init", path: "/tmp/create-init" } },
      ...seedTemplateResponses,
      { status: 200, body: [{ agent_id: "opencode", is_default: true }] },
      skillListResponse,
      ...skillGetResponses,
    ]);
    const root = setup("create-init");

    const fakeHome = join(tmpBase, "__fake-home__");
    const project = await createAndInitProject(root, "Test", { homedir: fakeHome, repoPaths: [root] });

    expect(project).toEqual({ id: "proj-1", name: "Test" });
    // 1 create + 1 register + 6 templates + 1 agents + 1 skill list + 2 skill gets = 12
    expect(globalThis.fetch).toHaveBeenCalledTimes(12);

    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("proj-1");

    expect(existsSync(join(root, ".pstdio", "docs", "navigation.json"))).toBe(true);
    expect(existsSync(join(root, ".pstdio", "docs", "index.md"))).toBe(true);

    expect(existsSync(join(root, ".opencode", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".opencode", "skills", "implement-ticket", "SKILL.md"))).toBe(true);
  });

  test("creates project with no repos when repoPaths is empty", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-no-repo", name: "NoRepo" } },
      ...seedTemplateResponses,
      { status: 200, body: [] }, // no agents configured
    ]);
    const root = setup("no-repo");

    const project = await createAndInitProject(root, "NoRepo", {
      homedir: join(tmpBase, "__fake-home__"),
      repoPaths: [],
    });

    expect(project).toEqual({ id: "proj-no-repo", name: "NoRepo" });
    // 1 create + 0 registerRepo + 6 templates + 1 agents (empty → early return) = 8
    expect(globalThis.fetch).toHaveBeenCalledTimes(8);

    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("proj-no-repo");
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

    const project = await createAndInitProject(root, "HasDocs", {
      homedir: join(tmpBase, "__fake-home__"),
      repoPaths: [root],
    });
    expect(project).toEqual({ id: "proj-3", name: "HasDocs" });

    // Should NOT have added starter files
    expect(existsSync(join(docsDir, "navigation.json"))).toBe(false);
    expect(existsSync(join(docsDir, "index.md"))).toBe(false);
    // Existing doc untouched
    expect(readFileSync(join(docsDir, "my-doc.md"), "utf8")).toBe("existing doc");
  });
});
