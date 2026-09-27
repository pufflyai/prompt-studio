import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { EXTENSION_API_VERSION, type WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { remoteWorkspaceCapabilities } from "../../workspaces/workspace-provider.test-fixture";
import { createProjectRoutes } from "../routes";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: { home?: string; defaults?: string };
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "retry-project-setup-"));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp();
});
afterEach(async () => {
  await handle.close();
  await rm(root, { recursive: true, force: true });
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
});

test.each([
  true,
  false,
])("retries remote project setup while preserving provider ownership (available: %s)", async (initiallyAvailable) => {
  const source = join(root, "default-extension");
  await mkdir(source);
  await writeFile(
    join(source, "package.json"),
    JSON.stringify({
      name: "retry-fixture",
      publisher: "example",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  await writeFile(join(source, "extension.ts"), 'import "./missing-dependency.ts"; export default {};');
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "retry-fixture", skipInstall: true }]);
  let available = initiallyAvailable;
  const creations: string[] = [];
  const reference = { version: 1, data: { remoteId: "remote-1" } };
  const ready = {
    state: "ready" as const,
    executionKind: "remote" as const,
    providerRef: reference,
    capabilities: remoteWorkspaceCapabilities,
  };
  const provider: WorkspaceTypeProvider = {
    id: "remote",
    ref: { kind: "workspace-type", id: "remote" },
    label: "Remote",
    create: (_ctx, input) => {
      creations.push(input.operationId);
      return ready;
    },
    resolve: () => ready,
  };
  const app = new OpenAPIHono<AppBindings>();
  const deps = {
    ...handle.deps,
    workspaceProviderRuntime: { find: async () => (available ? { context: {} as never, provider } : null) },
  };
  app.route("/v1", createProjectRoutes(deps));
  const response = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initial_workspace: { provider_id: "example.remote", params: { image: "documents" } } }),
  });
  expect(response.status).toBe(201);
  const project = await response.json();
  const failed = await handle.deps.workspaceService.getDefault(project.id);
  expect(failed?.setup_error).toContain("missing-dependency");
  const stillFailed = await app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
  expect(stillFailed.status).toBe(200);
  expect((await stillFailed.json()).setup_error).toContain("missing-dependency");
  await writeFile(join(source, "extension.ts"), "export default {};");
  available = true;
  const retried = await app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
  expect(retried.status).toBe(200);
  expect(await retried.json()).toMatchObject({
    id: failed!.id,
    project_id: project.id,
    root_path: null,
    provider_ref_json: reference,
    provider_state: "ready",
    initializing: false,
    setup_error: null,
  });
  expect(creations).toHaveLength(1);
  if (!initiallyAvailable) expect(creations[0]).toBe(failed!.provider_operation_id!);
  expect(await handle.deps.projectService.list()).toHaveLength(1);
});

test("retry requires an existing project and attached initial workspace", async () => {
  const missing = await handle.app.request("/v1/projects/missing/retry-setup", { method: "POST" });
  expect(missing.status).toBe(404);
  const project = await handle.deps.projectService.create({ name: "Unattached" });
  const response = await handle.app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
  expect(response.status).toBe(409);
});

test("project setup retry leaves other pending workspaces untouched", async () => {
  const project = await handle.deps.projectService.create({ name: "Remote recovery" });
  const home = await handle.deps.workspaceService.ensureDefault({
    project_id: project.id,
    name: "Default",
    provider_id: "example.remote",
  });
  const sibling = await handle.deps.workspaceService.createStandalone({
    project_id: project.id,
    provider_id: "example.remote",
  });
  for (const workspace of [home, sibling]) {
    await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
      execution_kind: "remote",
      provider_state: workspace.id === home.id ? "ready" : "provisioning",
      provider_capabilities_json: remoteWorkspaceCapabilities,
      provider_ref_json: { version: 1, data: { remoteId: workspace.id } },
    });
  }
  await handle.deps.workspaceService.setSetupError(home.id, "Previous extension setup failure");
  const resolved: string[] = [];
  const provider: WorkspaceTypeProvider = {
    id: "remote",
    ref: { kind: "workspace-type", id: "remote" },
    label: "Remote",
    create: () => {
      throw new Error("Existing workspaces must keep their provider references");
    },
    resolve: (_context, input) => {
      resolved.push(input.workspaceId);
      return {
        state: "ready",
        executionKind: "remote",
        providerRef: input.providerRef,
        capabilities: remoteWorkspaceCapabilities,
      };
    },
  };
  const app = new OpenAPIHono<AppBindings>();
  const deps = {
    ...handle.deps,
    workspaceProviderRuntime: { find: async () => ({ context: {} as never, provider }) },
  };
  app.route("/v1", createProjectRoutes(deps));
  const response = await app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: home.id, provider_state: "ready", setup_error: null });
  expect(resolved).toEqual([home.id]);
  expect(await handle.deps.workspaceService.get(sibling.id)).toMatchObject({ provider_state: "provisioning" });
});

test.each([
  true,
  false,
])("waits for remote retry readiness using the stored reference (present: %s)", async (hasReference) => {
  const project = await handle.deps.projectService.create({ name: "Remote recovery" });
  const reference = { version: 1, data: { remoteId: "remote-1" } };
  const workspace = await handle.deps.workspaceService.ensureDefault({
    project_id: project.id,
    name: "Remote",
    provider_id: "example.remote",
    provider_params_json: { image: "documents" },
    provider_state: "provider_missing",
    provider_operation_id: "original-create",
    provider_operation_kind: "create",
  });
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    execution_kind: "remote",
    provider_state: "provider_missing",
    provider_capabilities_json: remoteWorkspaceCapabilities,
    provider_ref_json: hasReference ? reference : null,
  });
  await handle.deps.workspaceService.setSetupError(workspace.id, "Previous extension setup failure");
  const creations: string[] = [];
  const resolutions: unknown[] = [];
  const pending = {
    state: "provisioning" as const,
    executionKind: "remote" as const,
    providerRef: reference,
    capabilities: remoteWorkspaceCapabilities,
  };
  const provider: WorkspaceTypeProvider = {
    id: "remote",
    ref: { kind: "workspace-type", id: "remote" },
    label: "Remote",
    create: (_ctx, input) => {
      creations.push(input.operationId);
      expect(input.workspaceId).toBe(workspace.id);
      expect(input.params).toEqual({ image: "documents" });
      return pending;
    },
    resolve: (_ctx, input) => {
      resolutions.push(input.providerRef);
      return { ...pending, state: resolutions.length > 1 ? "ready" : "provisioning" };
    },
  };
  const app = new OpenAPIHono<AppBindings>();
  const deps = {
    ...handle.deps,
    workspaceProviderRuntime: { find: async () => ({ context: {} as never, provider }) },
  };
  app.route("/v1", createProjectRoutes(deps));

  const response = await app.request(`/v1/projects/${project.id}/retry-setup`, { method: "POST" });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    id: workspace.id,
    project_id: project.id,
    root_path: null,
    provider_state: "ready",
    provider_ref_json: reference,
    provider_operation_id: null,
    initializing: false,
    setup_error: null,
  });
  expect(creations).toEqual(hasReference ? [] : ["original-create"]);
  expect(resolutions).toEqual([reference, reference]);
});
