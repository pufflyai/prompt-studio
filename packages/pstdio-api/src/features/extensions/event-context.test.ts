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

test("git merge events restore the trusted repository path", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  let payload: unknown;
  snapshot.runtime.hooks.push({
    id: "merged",
    localId: "merged",
    extensionId: "example.context",
    name: "context",
    sourcePath: fixture.root,
    eventId: "git.merged",
    handler: async (_ctx, event) => {
      payload = event;
    },
  });
  await fireExtensionEvent(fixture.deps, "project-1", "git.merged", {
    repoPath: "/forged",
    workspaceId: fixture.workspace.id,
  });
  expect(payload).toMatchObject({ repoPath: fixture.root, workspaceId: fixture.workspace.id });
});

test("deleted workspace hooks receive the committed snapshot without mounting its removed files", async () => {
  const snapshot = await fixture.deps.extensionRuntimeCatalog.get("project-1");
  let payload: unknown;
  let mounted: unknown;
  snapshot.runtime.hooks.push({
    id: "deleted",
    localId: "deleted",
    extensionId: "example.context",
    name: "context",
    sourcePath: fixture.root,
    eventId: "workspace.deleted",
    handler: async (ctx, event) => {
      payload = event;
      mounted = ctx.workspaceFiles;
    },
  });
  const deleted = { ...fixture.workspace, deleted_at: new Date().toISOString() };
  const deps = {
    ...fixture.deps,
    workspaceService: {
      ...fixture.deps.workspaceService,
      get: async () => {
        throw new Error("Deleted workspace rows must not be fetched.");
      },
    },
  };
  await fireExtensionEvent(deps, "project-1", "workspace.deleted", { workspace: deleted }, deleted);
  expect(payload).toMatchObject({
    workspace: { id: deleted.id, deleted_at: deleted.deleted_at },
    workspaceId: deleted.id,
  });
  expect(mounted).toBeUndefined();
});
