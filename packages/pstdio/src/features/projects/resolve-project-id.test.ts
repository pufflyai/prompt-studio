import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectId } from "./resolve-project-id";

const tmpBase = join(import.meta.dirname, "__test-tmp-resolve-project-id__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
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
