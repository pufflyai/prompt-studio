import { afterEach, beforeEach, expect, test } from "bun:test";
import { createWorkspaceContextFixture } from "../workspace-context.test-fixture";
import { createCommandEnvironment } from "./index";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});
const environment = () =>
  createCommandEnvironment(fixture.deps, [fixture.source] as never, {
    project: { id: "project-1", name: "Project", shorthand: "P" },
    projectId: "project-1",
    extensionId: "example.context",
    name: "context",
  });

test("cancelling an already settled local or remote workspace retains its location projection", async () => {
  const api = environment().workspaces;
  expect(await api.cancel(fixture.workspace.id)).toMatchObject({ root_path: fixture.root });
  Object.assign(fixture.workspace, { execution_kind: "remote", root_path: null });
  expect(await api.cancel(fixture.workspace.id)).toMatchObject({ root_path: null });
});

test("workspace readers map public fields and keep provider references private", async () => {
  const api = environment().workspaces;
  const workspace = await api.get(fixture.workspace.id);
  if (!workspace) throw new Error("Workspace not found");
  expect(workspace).toMatchObject({
    id: fixture.workspace.id,
    projectId: fixture.workspace.project_id,
    rootPath: fixture.root,
    root_path: fixture.root,
    providerId: fixture.workspace.provider_id,
    providerState: fixture.workspace.provider_state,
    shorthand: fixture.workspace.workspace_shorthand,
    createdAt: fixture.workspace.created_at,
    capabilities: fixture.workspace.provider_capabilities_json,
  });
  for (const field of ["provider_ref_json", "provider_error_json", "deleted_at", "provider_params_json"])
    expect(workspace).not.toHaveProperty(field);
  expect(await api.getDefault()).toEqual(workspace);
  expect(await api.cancel(fixture.workspace.id)).toEqual(workspace);
});
