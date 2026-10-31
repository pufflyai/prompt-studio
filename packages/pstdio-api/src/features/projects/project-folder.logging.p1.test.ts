import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { initializeProjectWorkspace } from "./project-folder";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: NodeJS.ProcessEnv;

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "project-setup-log-"));
  previous = { ...process.env };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_LOG_PATH = join(root, "logs.jsonl");
  process.env.PSTDIO_LOG_LEVEL = "warn";
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp();
});

afterEach(async () => {
  await handle.close();
  for (const key of ["PSTDIO_HOME", "PSTDIO_LOG_PATH", "PSTDIO_LOG_LEVEL", "PSTDIO_DEFAULT_EXTENSIONS"]) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  rmSync(root, { recursive: true, force: true });
});

const setupEntries = (projectId: string) =>
  readFileSync(join(root, "logs.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((entry) => entry.event === "runtime.setup.phase" && entry.project_id === projectId);

test("project logs identify extension setup while it is pending and provisioning after it resumes", async () => {
  const project = await handle.deps.projectService.create({ name: "Project" });
  const folder = join(root, "project");
  mkdirSync(folder);
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<[]>();
  const pending = initializeProjectWorkspace(
    handle.deps,
    project.id,
    { provider_id: "pstdio.root", params: { path: folder } },
    () => {
      started.resolve();
      return release.promise;
    },
  );
  try {
    await started.promise;
    const entries = setupEntries(project.id).filter((entry) => entry.phase === "project.extensions");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.state).toBe("started");
  } finally {
    release.resolve([]);
    await pending;
  }
  const entries = setupEntries(project.id);
  const start = entries.find((entry) => entry.phase === "project.extensions" && entry.state === "started")!;
  expect(entries).toContainEqual(expect.objectContaining({ span_id: start.span_id, state: "completed" }));
  expect(entries).toContainEqual(expect.objectContaining({ phase: "project.provision", state: "completed" }));
  expect(await handle.deps.workspaceService.getDefault(project.id)).toMatchObject({
    initializing: false,
    setup_error: null,
  });
});

test("project logs retain the failed setup step when the workspace records its error", async () => {
  const project = await handle.deps.projectService.create({ name: "Project" });
  const folder = join(root, "project");
  mkdirSync(folder);
  await initializeProjectWorkspace(
    handle.deps,
    project.id,
    { provider_id: "pstdio.root", params: { path: folder } },
    async () => {
      throw new Error("fixture setup failed");
    },
  );
  expect(setupEntries(project.id)).toContainEqual(
    expect.objectContaining({ phase: "project.extensions", state: "failed" }),
  );
  expect(await handle.deps.workspaceService.getDefault(project.id)).toMatchObject({
    initializing: false,
    setup_error: "fixture setup failed",
  });
});

test("retrying a repo default completes registration and workspace setup", async () => {
  const { writeExtension } = await import("../extensions/default-extensions-test-fixtures");
  const { writeFileSync, existsSync } = await import("node:fs");
  const project = await handle.deps.projectService.create({ name: "Repo retry" });
  const folder = join(root, "project");
  const source = join(root, "repo-tool");
  const available = join(root, "available");
  mkdirSync(folder);
  writeExtension(source, "repo-tool", "repo");
  writeFileSync(
    join(source, "extension.ts"),
    `
    if (!(await Bun.file(${JSON.stringify(available)}).exists())) throw new Error("Source unavailable");
    export default {};
  `,
  );
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "repo-tool", skipInstall: true }]);
  await initializeProjectWorkspace(handle.deps, project.id, { provider_id: "pstdio.root", params: { path: folder } });
  expect((await handle.deps.workspaceService.getDefault(project.id))?.setup_error).toContain("Source unavailable");
  writeFileSync(available, "ready");
  const job = handle.deps.extensionInstallations.list().find((item) => item.installName === "repo-tool")!;
  handle.deps.extensionInstallations.retry(job.id);
  await handle.deps.extensionInstallations.wait(job.id);
  expect(existsSync(join(folder, ".pstdio", "extensions", "repo-tool", "extension.ts"))).toBe(true);
  expect(await handle.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(1);
  expect(await handle.deps.workspaceService.getDefault(project.id)).toMatchObject({
    initializing: false,
    setup_error: null,
  });
});
