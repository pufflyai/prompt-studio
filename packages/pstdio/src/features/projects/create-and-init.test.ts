import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resetApiClient } from "@/features/api-client";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { createAndInitProject } from "./create-and-init";

const tmpBase = join(import.meta.dirname, "__test-tmp__");

const setup = (name: string) => {
  const dir = join(tmpBase, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};

beforeEach(() => {
  resetApiClient();
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("createAndInitProject", () => {
  test("delegates repo initialization to the API when creating inside a repo", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-1", name: "Test" } },
      { status: 201, body: { id: "repo-1", name: "create-init", path: "/tmp/create-init" } },
    ]);
    const root = setup("create-init");

    const fakeHome = join(tmpBase, "__fake-home__");
    const project = await createAndInitProject(root, "Test", { homedir: fakeHome, repoPaths: [root] });

    expect(project).toEqual({ id: "proj-1", name: "Test" } as never);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(existsSync(join(root, ".pstdio"))).toBe(false);
    expect(existsSync(join(root, ".agents"))).toBe(false);
  });

  test("creates project with no repos when repoPaths is empty", async () => {
    mockFetchSequence([
      { status: 201, body: { id: "proj-no-repo", name: "NoRepo" } },
      { status: 200, body: [] }, // no agents configured
      { status: 200, body: [] }, // no installed agents available
    ]);
    const root = setup("no-repo");

    const project = await createAndInitProject(root, "NoRepo", {
      homedir: join(tmpBase, "__fake-home__"),
      repoPaths: [],
    });

    expect(project).toEqual({ id: "proj-no-repo", name: "NoRepo" } as never);
    // 1 create + 0 registerRepo + 1 agents + 1 agents/info = 3
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);

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
});
