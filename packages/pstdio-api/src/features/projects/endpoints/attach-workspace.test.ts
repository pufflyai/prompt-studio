import { afterAll, beforeAll, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { WorkspaceProviderResult, WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../../test-utils/create-test-app";
import type { AppBindings } from "../../../types";
import { resolveSessionWorkspaceContext } from "../../sessions/session-workspace-context";
import { waitForWorkspaceReady } from "../../workspaces/wait-for-ready";
import { remoteWorkspaceCapabilities } from "../../workspaces/workspace-provider.test-fixture";
import { attachWorkspaceHandler, attachWorkspaceRoute } from "./attach-workspace";

let handle: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  handle = await createTestApp();
});
afterAll(async () => {
  await handle.close();
});

test("attaching a remote provider keeps the existing workspace ready for sessions", async () => {
  const project = await handle.deps.projectService.create({ name: "Legacy project" });
  const existing = await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Default" });
  const result = {
    providerRef: { version: 1, data: { remoteId: "remote-1" } },
    state: "ready",
    executionKind: "remote",
    capabilities: remoteWorkspaceCapabilities,
  } satisfies WorkspaceProviderResult;
  const provider: WorkspaceTypeProvider = {
    id: "remote",
    ref: { kind: "workspace-type", id: "remote" },
    label: "Remote",
    create: () => result,
    resolve: () => result,
  };
  const deps = {
    ...handle.deps,
    workspaceProviderRuntime: { find: async () => ({ context: {} as never, provider }) },
  };
  const app = new OpenAPIHono<AppBindings>();
  app.openapi(attachWorkspaceRoute, attachWorkspaceHandler(deps));
  const response = await app.request(`/projects/${project.id}/initial-workspace`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider_id: "example.remote", params: { image: "documents" } }),
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    id: existing.id,
    root_path: null,
    provider_state: "ready",
    execution_kind: "remote",
    initializing: false,
    setup_error: null,
  });

  const session = await handle.deps.sessionService.create({
    project_id: project.id,
    title: "Remote session",
    agent: "example.agent",
  });
  await handle.deps.workspaceSessionService.link(existing.id, session.id);
  const ready = await waitForWorkspaceReady(handle.deps, session.id, { timeoutMs: 10, pollMs: 1 });
  expect(ready?.initializing).toBe(false);
  expect(await resolveSessionWorkspaceContext(handle.deps.workspaceSessionService, session.id)).toEqual({
    workspaceId: existing.id,
    executionTarget: {
      kind: "remote",
      providerId: "example.remote",
      providerRef: result.providerRef,
    },
  });
});
