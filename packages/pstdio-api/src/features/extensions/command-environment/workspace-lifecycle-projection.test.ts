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

test("deprecated archive deletes through the provider path and returns the workspace projection", async () => {
  const { workspace, deps, root } = fixture;
  Object.assign(workspace, { is_default: false, provider_id: "pstdio.worktree", root_path: root });
  Object.assign(workspace.provider_capabilities_json, { delete: true });
  deps.workspaceService.updateProviderProjection = async (_id, patch) => Object.assign(workspace, patch) as never;
  deps.workspaceService.softDelete = async () => Object.assign(workspace, { deleted_at: "now" }) as never;
  deps.workspaceSessionService = { listByWorkspace: async () => [] } as never;
  const result = await environment().workspaces.archive(workspace.id);
  expect(result).toMatchObject({ id: workspace.id, deleted_at: expect.any(String), root_path: root });
});
