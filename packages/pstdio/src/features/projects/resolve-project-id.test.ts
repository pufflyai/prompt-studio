import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectId } from "./resolve-project-id";

const tmpBase = join(import.meta.dirname, "__test-tmp-resolve-project-id__");
const previousProjectId = process.env.PSTDIO_PROJECT_ID;

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
  delete process.env.PSTDIO_PROJECT_ID;
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
  if (previousProjectId === undefined) {
    delete process.env.PSTDIO_PROJECT_ID;
  } else {
    process.env.PSTDIO_PROJECT_ID = previousProjectId;
  }
});

describe("resolveProjectId", () => {
  test("returns explicit ID when provided", () => {
    const result = resolveProjectId("/any-dir", "explicit-id");

    expect(result.projectId).toBe("explicit-id");
  });

  test("returns root and projectId from config when no explicit ID", () => {
    const root = join(tmpBase, "repo");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, ".pstdio"), { recursive: true });
    writeFileSync(join(root, ".pstdio", "config.json"), '{"project_id":"proj-1"}');

    const result = resolveProjectId(root);

    expect(result.root).toBe(root);
    expect(result.projectId).toBe("proj-1");
    expect(result.workspaceId).toBeUndefined();
  });

  test("resolves workspaceId from a config that carries one", () => {
    const root = join(tmpBase, "worktree");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, ".pstdio"), { recursive: true });
    writeFileSync(join(root, ".pstdio", "config.json"), '{"project_id":"proj-1","workspace_id":"ws_host_1"}');

    const result = resolveProjectId(root);

    expect(result.projectId).toBe("proj-1");
    expect(result.workspaceId).toBe("ws_host_1");
  });

  test("falls back to PSTDIO_PROJECT_ID when the cwd is not linked", () => {
    process.env.PSTDIO_PROJECT_ID = "project-from-env";
    const root = join(tmpBase, "no-config-env");
    mkdirSync(join(root, ".git"), { recursive: true });

    const result = resolveProjectId(root);

    expect(result).toEqual({ projectId: "project-from-env", root });
  });

  test("throws when no explicit ID and no git root", () => {
    expect(() => resolveProjectId("/nonexistent-path-that-wont-match")).toThrow("No project specified");
  });

  test("throws when no explicit ID and no config", () => {
    const root = join(tmpBase, "no-config");
    mkdirSync(join(root, ".git"), { recursive: true });

    expect(() => resolveProjectId(root)).toThrow("No project specified");
  });
});
