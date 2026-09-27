import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveProjectId } from "../projects/resolve-project-id";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("discovers a plain-folder project from a nested working directory", () => {
  const root = mkdtempSync(join(tmpdir(), "folder-project-"));
  roots.push(root);
  mkdirSync(join(root, ".pstdio"));
  mkdirSync(join(root, "documents", "drafts"), { recursive: true });
  writeFileSync(join(root, ".pstdio/config.json"), JSON.stringify({ project_id: "notes", workspace_id: "local" }));
  expect(resolveProjectId(join(root, "documents/drafts"))).toEqual({ projectId: "notes", workspaceId: "local", root });
});

test("uses the nearest project folder inside a containing Git repository", () => {
  const root = mkdtempSync(join(tmpdir(), "nested-project-"));
  roots.push(root);
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, ".pstdio"));
  mkdirSync(join(root, "child/.pstdio"), { recursive: true });
  writeFileSync(join(root, ".pstdio/config.json"), JSON.stringify({ project_id: "parent" }));
  writeFileSync(join(root, "child/.pstdio/config.json"), JSON.stringify({ project_id: "child" }));
  expect(resolveProjectId(join(root, "child"))).toEqual({
    projectId: "child",
    workspaceId: undefined,
    root: join(root, "child"),
  });
});
