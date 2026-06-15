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
  test("delegates repo bootstrap to the API", async () => {
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
      {
        status: 201,
        body: {
          id: "repo-1",
          name: "link-scaffold",
          path: "/tmp/link-scaffold",
        },
      },
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
    } as never);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(existsSync(join(root, ".pstdio"))).toBe(false);
    expect(existsSync(join(root, ".agents"))).toBe(false);
  });

  test("throws when project not found", async () => {
    mockFetchSequence([{ status: 404, body: { error: "Not found" } }]);
    const root = setup("link-404");

    expect(linkProject(root, "missing")).rejects.toThrow("Project not found: missing");
  });

  test("delegates stale ticket cleanup to the API", async () => {
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
      {
        status: 201,
        body: { id: "repo-1", name: "link-relink", path: "/tmp/link-relink" },
      },
    ]);

    const root = setup("link-relink");
    const ticketsDir = join(root, ".pstdio", "tickets", "PS-1");
    mkdirSync(ticketsDir, { recursive: true });
    writeFileSync(join(root, ".pstdio", "config.json"), `${JSON.stringify({ project_id: "old-project" }, null, 2)}\n`);
    writeFileSync(join(ticketsDir, "ticket.md"), "# old ticket\n");

    await linkProject(root, "new-project", {
      homedir: join(tmpBase, "__fake-home__"),
    });

    expect(existsSync(join(root, ".pstdio", "tickets"))).toBe(true);
    const config = JSON.parse(readFileSync(join(root, ".pstdio", "config.json"), "utf8"));
    expect(config.project_id).toBe("old-project");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
