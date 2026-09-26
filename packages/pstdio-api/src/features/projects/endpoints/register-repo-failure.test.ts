import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let previousDefaults: string | undefined;

beforeAll(async () => {
  root = await realpath(mkdtempSync(join(tmpdir(), "register-repo-failure-")));
  previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify({ defaultExtensions: [] });
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage"), buildWebviews: false });
});

afterAll(async () => {
  await handle.close();
  if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
  rmSync(root, { recursive: true, force: true });
});

const register = (id: string, path: string) =>
  handle.app.request(`/v1/projects/${id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "repo", path }),
  });

const expectClean = async (projectId: string, seq: number) => {
  const listed = await handle.app.request(`/v1/projects/${projectId}/repos`);
  expect(await listed.json()).toEqual([]);
  expect(await handle.deps.workspaceService.getDefault(projectId)).toBeNull();
  expect(
    handle.deps.eventBus.getSince(seq).filter((event) => ["repos", "project_repos"].includes(event.table)),
  ).toEqual([]);
};

test("a regular file path leaves no registered repository or events", async () => {
  const project = await handle.deps.projectService.create({ name: "File path" });
  const path = join(root, "file");
  writeFileSync(path, "file");
  const seq = handle.deps.eventBus.seq;
  const response = await register(project.id, path);
  expect(response.ok).toBe(false);
  await expectClean(project.id, seq);
  expect(response.status).toBe(400);
});

test("a missing directory is rejected without creating it", async () => {
  const project = await handle.deps.projectService.create({ name: "Missing path" });
  const path = join(root, "missing");
  const seq = handle.deps.eventBus.seq;
  expect((await register(project.id, path)).status).toBe(400);
  expect(existsSync(path)).toBe(false);
  await expectClean(project.id, seq);
});

test("bootstrap failure rolls back registration and a repaired path can be retried", async () => {
  const project = await handle.deps.projectService.create({ name: "Retry" });
  const path = join(root, "retry");
  mkdirSync(path);
  writeFileSync(join(path, ".pstdio"), "blocks bootstrap");
  const seq = handle.deps.eventBus.seq;
  expect((await register(project.id, path)).status).toBe(500);
  await expectClean(project.id, seq);
  rmSync(join(path, ".pstdio"));
  expect((await register(project.id, path)).status).toBe(201);
  expect((await register(project.id, path)).status).toBe(201);
  expect(await handle.deps.repoService.listByProject(project.id)).toHaveLength(1);
  expect(await handle.deps.workspaceService.list(project.id)).toHaveLength(1);
});

// Windows chmod does not enforce POSIX directory write permissions.
test.skipIf(process.platform === "win32")("a read-only directory leaves no registration state", async () => {
  const project = await handle.deps.projectService.create({ name: "Read only" });
  const path = join(root, "readonly");
  mkdirSync(path);
  chmodSync(path, 0o500);
  try {
    const seq = handle.deps.eventBus.seq;
    const response = await register(project.id, path);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("EACCES");
    await expectClean(project.id, seq);
  } finally {
    chmodSync(path, 0o700);
  }
});

test("extension discovery failure after bootstrap leaves no registration state", async () => {
  const project = await handle.deps.projectService.create({ name: "Extension discovery failure" });
  const path = join(root, "extension-failure");
  mkdirSync(join(path, ".pstdio"), { recursive: true });
  writeFileSync(join(path, ".pstdio", "extensions"), "blocks extension discovery");
  const seq = handle.deps.eventBus.seq;
  expect((await register(project.id, path)).status).toBe(500);
  expect(existsSync(join(path, ".pstdio", "config.json"))).toBe(false);
  await expectClean(project.id, seq);
});
