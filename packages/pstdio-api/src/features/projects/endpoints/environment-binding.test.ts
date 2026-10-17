import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";

let first: Awaited<ReturnType<typeof createTestApp>>;
let second: typeof first;
let root: string;
const json = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "local-workbench-bindings-"));
  first = await createTestApp();
  second = await createTestApp();
});
afterAll(async () => {
  await first?.close();
  await second?.close();
  await rm(root, { recursive: true, force: true });
});

test("two runtime owners bind the same workbench to independent folders and keep local projects", async () => {
  const workbenchId = crypto.randomUUID();
  const bindings = [];
  for (const [handle, folder] of [
    [first, "first"],
    [second, "second"],
  ] as const) {
    const local = await handle.deps.projectService.create({ name: "Local only" });
    const identity = await (await handle.app.request("/v1/environment")).json();
    const path = join(root, folder);
    await mkdir(path);
    const body = {
      environmentId: identity.environmentId,
      name: "Shared",
      initial_workspace: { provider_id: "pstdio.root", params: { path } },
    };
    const response = await handle.app.request(`/v1/projects/${workbenchId}/environment-binding`, json(body));
    expect(response.status).toBe(201);
    const binding = await response.json();
    bindings.push(binding);
    expect(binding).toMatchObject({
      environmentId: identity.environmentId,
      workbenchId,
      workspace: { project_id: workbenchId, root_path: await realpath(path) },
    });
    expect(JSON.parse(await readFile(join(path, ".pstdio/config.json"), "utf8"))).toMatchObject({
      project_id: workbenchId,
      workspace_id: binding.workspace.id,
    });
    expect(await handle.deps.projectService.get(local.id)).toMatchObject({ name: "Local only" });
    const retried = await handle.app.request(`/v1/projects/${workbenchId}/environment-binding`, json(body));
    expect(retried.status).toBe(200);
    expect((await retried.json()).workspace.id).toBe(binding.workspace.id);
  }
  expect(bindings[0].environmentId).not.toBe(bindings[1].environmentId);
  expect(bindings[0].workspace.id).not.toBe(bindings[1].workspace.id);
  expect(await first.deps.workspaceService.get(bindings[1].workspace.id)).toBeNull();
});

test("binding rejects a different environment without creating a workbench or folder", async () => {
  const workbenchId = crypto.randomUUID();
  const response = await first.app.request(
    `/v1/projects/${workbenchId}/environment-binding`,
    json({
      environmentId: "another-environment",
      name: "Wrong target",
      initial_workspace: { provider_id: "pstdio.root", params: { path: join(root, "wrong") } },
    }),
  );
  expect(response.status).toBe(409);
  expect(await first.deps.projectService.get(workbenchId)).toBeNull();
});

test("explicit targets never substitute the default workspace or a different workbench", async () => {
  const identity = await (await first.app.request("/v1/environment")).json();
  const project = await first.deps.projectService.create({ name: "Target owner" });
  const workspace = await first.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default" });
  const target = { environmentId: identity.environmentId, workbenchId: project.id, workspaceId: workspace.id };
  const resolve = (input: unknown) =>
    first.app.request("/v1/environment/resolve-target", { ...json(input), method: "POST" });
  expect((await resolve(target)).status).toBe(200);
  expect((await resolve({ ...target, environmentId: "other" })).status).toBe(409);
  expect((await resolve({ ...target, workbenchId: "other" })).status).toBe(404);
  expect((await resolve({ ...target, workspaceId: "missing" })).status).toBe(404);
});

test("binding preserves an existing workbench's folder and rejects caller-supplied account authority", async () => {
  const identity = await (await first.app.request("/v1/environment")).json();
  const project = await first.deps.projectService.create({ name: "Existing owner" });
  const ownedPath = join(root, "owned");
  await mkdir(ownedPath);
  const bound = await first.app.request(
    `/v1/projects/${project.id}/environment-binding`,
    json({
      ...identity,
      name: project.name,
      initial_workspace: { provider_id: "pstdio.root", params: { path: ownedPath } },
    }),
  );
  expect(bound.status).toBe(201);
  const original = await first.deps.workspaceService.getDefault(project!.id);
  const path = join(root, "replacement");
  await mkdir(path);
  const body = { ...identity, name: "Replaced", initial_workspace: { provider_id: "pstdio.root", params: { path } } };
  expect((await first.app.request(`/v1/projects/${project!.id}/environment-binding`, json(body))).status).toBe(409);
  expect(await first.deps.workspaceService.getDefault(project!.id)).toEqual(original);
  expect(
    (
      await first.app.request(
        `/v1/projects/${crypto.randomUUID()}/environment-binding`,
        json({ ...body, accountId: "untrusted" }),
      )
    ).status,
  ).toBe(400);
});

test("binding attaches an existing empty default workspace without replacing its identity", async () => {
  const identity = await (await first.app.request("/v1/environment")).json();
  const project = await first.deps.projectService.create({ name: "Unbound" });
  const placeholder = await first.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default" });
  const path = join(root, "unbound");
  await mkdir(path);
  const response = await first.app.request(
    `/v1/projects/${project.id}/environment-binding`,
    json({ ...identity, name: project.name, initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
  );
  expect(response.status).toBe(201);
  expect((await response.json()).workspace).toMatchObject({ id: placeholder.id, root_path: await realpath(path) });
});
