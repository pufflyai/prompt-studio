import { expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { sessionPresentation } from "./session-presentation";

const selected: ExtensionWorkspace = {
  id: "a",
  name: "Workspace",
  capabilities: { files: "write", diff: true, merge: false, rebase: false, delete: false },
};
const context = (workspace: ExtensionWorkspace | undefined = selected) =>
  makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      workspaces: {
        get: async (id) => (id === workspace?.id ? workspace : null),
        diffSummary: async () => ({ workspace_id: "a", additions: 12, deletions: 3, file_count: 1 }),
      },
    },
  });

test("only a saved session with its selected available workspace exposes Open", async () => {
  const ctx = context();
  expect((await sessionPresentation.run(ctx, { id: "a" })).openResourceId).toBeUndefined();
  expect((await sessionPresentation.run(ctx, { id: "missing", existingSession: true })).openResourceId).toBeUndefined();
  expect(
    (await sessionPresentation.run(ctx, { id: "a", existingSession: true, available: false })).openResourceId,
  ).toBeUndefined();
  expect((await sessionPresentation.run(ctx, { id: "a", existingSession: true })).openResourceId).toBe("a");
});

test("Workspaces owns diff and setup presentation without reading a remote workspace diff", async () => {
  expect(await sessionPresentation.run(context(), { id: "a" })).toMatchObject({ additions: 12, deletions: 3 });
  for (const workspace of [
    { ...selected, initializing: true },
    { ...selected, setupError: "Setup failed" },
    { ...selected, device: { id: "laptop", name: "Laptop", ownerId: "owner" } },
  ]) {
    const ctx = context(workspace);
    let reads = 0;
    ctx.workspaces.diffSummary = async () => {
      reads++;
      throw new Error("Diff not available");
    };
    const result = await sessionPresentation.run(ctx, { id: "a", existingSession: true });
    expect(reads).toBe(0);
    expect(result).toMatchObject({ additions: 0, deletions: 0 });
    if (workspace.initializing) expect(result.status).toBe("loading");
    if (workspace.setupError) expect(result).toMatchObject({ status: "error", statusLabel: "Setup failed" });
  }
});
