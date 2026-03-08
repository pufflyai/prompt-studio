import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { linkProject } from "./link-project";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const skillFixture = (name: string) => ({
  id: `id-${name}`,
  project_id: "abc",
  name,
  description: `${name} desc`,
  file_id: `file-${name}`,
  content: `---\nname: ${name}\n---\n${name} content`,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const SKILL_NAMES = ["create-ticket"];
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
      skillListResponse,
      ...skillGetResponses,
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
    // 1 get project + 1 register repo + 1 agents + 1 skill list + 1 skill get = 5
    expect(globalThis.fetch).toHaveBeenCalledTimes(5);

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
      { status: 200, body: [] }, // no agents → early return from installDefaultSkills
    ]);
    const root = setup("link-existing-docs");

    const docsDir = join(root, ".pstdio", "docs");
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, "local.md"), "local content");

    await linkProject(root, "abc", { homedir: join(tmpBase, "__fake-home__") });

    expect(readFileSync(join(docsDir, "local.md"), "utf8")).toBe("local content");
    // 1 get project + 1 register repo + 1 agents (empty) = 3
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test("throws when project not found", async () => {
    mockFetchSequence([{ status: 404, body: { error: "Not found" } }]);
    const root = setup("link-404");

    expect(linkProject(root, "missing")).rejects.toThrow("Project not found: missing");
  });

  test("removes local tickets when re-linking to a different project", async () => {
    mockFetchSequence([
      {
        status: 200,
        body: {
          id: "new-project",
          name: "New Project",
          shorthand: "NP",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
      { status: 201, body: { id: "repo-1", name: "link-relink", path: "/tmp/link-relink" } },
      { status: 200, body: [] },
    ]);

    const root = setup("link-relink");
    const ticketsDir = join(root, ".pstdio", "tickets", "PS-1_old-ticket");
    mkdirSync(ticketsDir, { recursive: true });
    writeFileSync(join(root, ".pstdio", "config.json"), `${JSON.stringify({ project_id: "old-project" }, null, 2)}\n`);
    writeFileSync(join(ticketsDir, "ticket.md"), "# old ticket\n");

    await linkProject(root, "new-project", { homedir: join(tmpBase, "__fake-home__") });

    expect(existsSync(join(root, ".pstdio", "tickets"))).toBe(false);
    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("new-project");
  });
});
