import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
beforeAll(async () => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  root = await realpath(await mkdtemp(join(tmpdir(), "folder-project-")));
  handle = await createTestApp();
});
afterAll(async () => {
  await handle?.close();
  await rm(root, { recursive: true, force: true });
  if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
});
const open = (path: string) =>
  handle.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
  });

test("opens empty and populated folders with numeric and Unicode names", async () => {
  for (const name of ["1234", "研究"]) {
    const folder = join(root, name);
    await mkdir(folder);
    if (name === "研究") await writeFile(join(folder, "notes.txt"), "keep me");
    const response = await open(folder);
    expect(response.status).toBe(201);
    const project = await response.json();
    expect(project.name).toBe(name);
    const workspace = await handle.deps.workspaceService.getDefault(project.id);
    expect(workspace).toMatchObject({
      root_path: folder,
      provider_id: "pstdio.root",
      provider_state: "ready",
      initializing: false,
      setup_error: null,
    });
    expect(workspace?.provider_capabilities_json).toMatchObject({ files: "write", diff: false, merge: false });
    expect(JSON.parse(await readFile(join(folder, ".pstdio/config.json"), "utf8")).project_id).toBe(project.id);
    if (name === "研究") expect(await readFile(join(folder, "notes.txt"), "utf8")).toBe("keep me");
  }
});

test("canonical aliases reopen one project while child folders remain distinct", async () => {
  const folder = join(root, "parent");
  await mkdir(join(folder, "child"), { recursive: true });
  await symlink(folder, join(root, "alias"));
  const responses = await Promise.all([open(folder), open(join(root, "alias"))]);
  const projects = await Promise.all(responses.map((r) => r.json()));
  expect(projects[0].id).toBe(projects[1].id);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
  const child = await (await open(join(folder, "child"))).json();
  expect(child.id).not.toBe(projects[0].id);
});

test("setup failure remains unavailable and a retry preserves the project and workspace", async () => {
  const folder = join(root, "retry");
  await mkdir(folder);
  await writeFile(join(folder, ".pstdio"), "user content");
  const project = await (await open(folder)).json();
  const failed = await handle.deps.workspaceService.getDefault(project.id);
  expect(failed?.setup_error).toBeTruthy();
  await rm(join(folder, ".pstdio"));
  const response = await open(folder);
  expect(response.status).toBe(200);
  expect((await response.json()).id).toBe(project.id);
  const ready = await handle.deps.workspaceService.getDefault(project.id);
  expect(ready?.id).toBe(failed?.id);
  expect(ready?.setup_error).toBeNull();
  expect(ready?.initializing).toBe(false);
});

test("attaches a folder to a legacy project without replacing its workspace history", async () => {
  const project = await handle.deps.projectService.create({ name: "Legacy" });
  const old = await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default" });
  const folder = join(root, "attach");
  await mkdir(folder);
  const response = await handle.app.request(`/v1/projects/${project.id}/initial-workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider_id: "pstdio.root", params: { path: folder } }),
  });
  expect(response.status).toBe(201);
  const attached = await handle.deps.workspaceService.getDefault(project.id);
  expect(attached?.id).toBe(old.id);
  expect(attached?.root_path).toBe(folder);
});

test("reopens an interrupted folder setup using the existing workspace", async () => {
  const folder = join(root, "interrupted");
  await mkdir(folder);
  const project = await handle.deps.projectService.create({ name: "Interrupted" });
  const workspace = await handle.deps.workspaceService.ensureDefault({
    project_id: project.id,
    name: "Project folder",
    root_path: folder,
    provider_id: "pstdio.root",
    provider_state: "provisioning",
    provider_operation_id: "original-create",
    provider_operation_kind: "create",
  });
  await handle.deps.workspaceService.setInitializing(workspace.id, true);
  const response = await open(folder);
  expect(response.status).toBe(200);
  const ready = await handle.deps.workspaceService.getDefault(project.id);
  expect(ready).toMatchObject({ id: workspace.id, provider_state: "ready", initializing: false, setup_error: null });
});
