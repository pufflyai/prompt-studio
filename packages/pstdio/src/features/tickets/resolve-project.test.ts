import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveProjectId } from "./resolve-project";

const tmpBase = join(import.meta.dirname, "__test-tmp-resolve__");

beforeEach(() => {
  mkdirSync(tmpBase, { recursive: true });
});

afterEach(() => {
  rmSync(tmpBase, { recursive: true, force: true });
});

describe("resolveProjectId", () => {
  test("returns root and projectId when config exists", () => {
    const root = join(tmpBase, "repo");
    mkdirSync(join(root, ".git"), { recursive: true });
    mkdirSync(join(root, ".pstdio"), { recursive: true });
    writeFileSync(join(root, ".pstdio", "config.json"), '{"project_id":"proj-1"}');

    const result = resolveProjectId(root);

    expect(result.root).toBe(root);
    expect(result.projectId).toBe("proj-1");
  });

  test("throws when no git root", () => {
    expect(() => resolveProjectId("/nonexistent-path-that-wont-match")).toThrow("Not inside a pstdio project");
  });

  test("throws when no config.json", () => {
    const root = join(tmpBase, "no-config");
    mkdirSync(join(root, ".git"), { recursive: true });

    expect(() => resolveProjectId(root)).toThrow("Not inside a pstdio project");
  });
});
