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
  expect(await api.cancel(fixture.workspace.id)).toMatchObject({ root_path: fixture.root, worktree_path: null });
  Object.assign(fixture.workspace, { execution_kind: "remote", worktree_path: fixture.root });
  expect(await api.cancel(fixture.workspace.id)).toMatchObject({ root_path: null, worktree_path: fixture.root });
});

test("archive returns the same projected workspace contract as get", async () => {
  const { workspace, deps, root } = fixture;
  Object.assign(workspace, { is_default: false, provider_id: "pstdio.worktree", worktree_path: root });
  Object.assign(workspace.provider_capabilities_json, { archive: true });
  deps.workspaceService.updateProviderProjection = async (_id, patch) => Object.assign(workspace, patch) as never;
  deps.workspaceService.archive = async () => Object.assign(workspace, { archived: true }) as never;
  deps.workspaceSessionService = { listByWorkspace: async () => [] } as never;
  const result = await environment().workspaces.archive(workspace.id);
  expect(result).toMatchObject({ id: workspace.id, archived: true, root_path: root, worktree_path: root });
});
