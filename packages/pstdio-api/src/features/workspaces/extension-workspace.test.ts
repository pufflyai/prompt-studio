import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { createTestApp } from "../../test-utils/create-test-app";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let server: ReturnType<typeof Bun.serve>;
let root: string;
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "workspace-shapes-")));
  handle = await createTestApp();
  server = Bun.serve({ port: 0, fetch: (request) => handle.app.fetch(request) });
});
afterAll(async () => {
  server?.stop(true);
  await handle?.close();
  await rm(root, { recursive: true, force: true });
});

test("camelCase and legacy workspace creation return the same public projection", async () => {
  const client = createClient({ baseUrl: server.url.toString() });
  const project = await client.projects.create({
    name: "Workspace shapes",
    initial_workspace: {
      provider_id: "pstdio.root",
      params: { path: root },
    },
  });
  const created = await client.workspaces.create({
    projectId: project.id,
    providerId: "pstdio.root",
    params: { path: root },
  });
  expect(created).toMatchObject({
    projectId: project.id,
    providerId: "pstdio.root",
    rootPath: root,
    project_id: project.id,
  });
  const commands = createWorkspacesApi(handle.deps, { projectId: project.id }, {} as never);
  const legacy = await commands.create({ project_id: project.id, provider_id: "pstdio.root", shorthand_base: "WS" });
  const current = await commands.create({ providerId: "pstdio.root" });
  expect(current).toEqual(legacy);
  expect(await commands.get(created.id)).toEqual(current);
  expect(await client.workspaces.getByShorthand(project.id, created.workspace_shorthand)).toMatchObject(current);
  expect(await client.workspaces.list(project.id)).toContainEqual(expect.objectContaining(current));
  for (const field of ["provider_ref_json", "provider_error_json", "deleted_at"])
    expect(current).not.toHaveProperty(field);
});
