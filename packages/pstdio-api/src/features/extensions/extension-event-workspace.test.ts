import { afterEach, beforeEach, expect, test } from "bun:test";
import { fireExtensionEvent } from "./extension-event-runtime";
import { createWorkspaceContextFixture } from "./workspace-context.test-fixture";

let fixture: Awaited<ReturnType<typeof createWorkspaceContextFixture>>;
beforeEach(async () => {
  fixture = await createWorkspaceContextFixture();
});
afterEach(async () => {
  await fixture.cleanup();
});

test("a real provision hook can run a process in its own workspace during setup repair", async () => {
  const { deps, workspace, values, root } = fixture;
  Object.assign(workspace, { initializing: true, setup_error: "retrying" });
  expect(
    (await fireExtensionEvent(deps, "project-1", "workspace.provision", { workspaceId: workspace.id })).delivered,
  ).toBe(1);
  expect(values.get("provision-cwd")).toBe(root);
});

for (const kind of ["root", "worktree", "remote"] as const) {
  test(`delivers trusted ${kind} workspace context through a real session hook`, async () => {
    const { deps, root, workspace, values } = fixture;
    if (kind !== "root")
      Object.assign(workspace, {
        is_default: false,
        provider_id: kind === "remote" ? "example.remote" : "pstdio.worktree",
        execution_kind: kind === "remote" ? "remote" : "local",
        worktree_path: root,
      });
    const result = await fireExtensionEvent(deps, "project-1", "session.started", {
      workspaceId: workspace.id,
      workspaceDir: "/forged",
      workspace: { root_path: "/forged" },
      worktreePath: workspace.worktree_path,
      sessionId: "session-1",
    });
    expect(result.delivered).toBe(1);
    const localRoot = kind === "remote" ? null : root;
    expect(values.get("delivered")).toMatchObject({
      workspaceId: workspace.id,
      text: localRoot ? "selected folder" : null,
      event: {
        sessionId: "session-1",
        worktreePath: workspace.worktree_path,
        workspace: { id: workspace.id, root_path: localRoot, worktree_path: workspace.worktree_path },
      },
    });
    const delivered = values.get("delivered") as { event: { workspaceDir?: string } };
    expect(delivered.event.workspaceDir).toBe(localRoot ?? undefined);
  });
}
