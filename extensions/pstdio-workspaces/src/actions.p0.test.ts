import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { remove, showCreate, showDelete } from "./actions";
import { workspacePages } from "./refs";

test("folderless projects can choose an installed remote workspace provider", async () => {
  const targets: NavigationTarget[] = [];
  const context = {
    workspaces: {
      getDefault: async () => null,
      listProviders: async () => [{ id: "example.cloud.workspace-type.remote", label: "Cloud", params: {} }],
    },
    navigation: { open: (target: NavigationTarget) => targets.push(target) },
  } as unknown as Parameters<typeof showCreate.run>[0];
  await showCreate.run(context, {});
  expect(targets).toEqual([{ kind: "page", page: workspacePages.form, params: { operation: "create" } }]);
});

test("deleting a workspace publishes removal without replacing another open resource", async () => {
  const targets: NavigationTarget[] = [];
  const deleted: string[] = [];
  const removed: unknown[] = [];
  const context = {
    project: { id: "project" },
    resource: { type: "workspace", id: "workspace", extensionId: "pstdio", projectId: "project" },
    workspaces: {
      get: async (id: string) => {
        if (id !== "workspace") throw new Error("Workspace not found");
        return { id, projectId: "project", capabilities: { delete: true } };
      },
      delete: async (id: string) => {
        deleted.push(id);
      },
    },
    resources: {
      removed: async (resource: unknown) => {
        removed.push(resource);
      },
    },
    events: { emit: async () => {} },
    navigation: { open: (target: NavigationTarget) => targets.push(target) },
  } as unknown as Parameters<typeof remove.run>[0];
  await remove.run(context, { id: "workspace", confirmed: true });
  expect(deleted).toEqual(["workspace"]);
  expect(removed).toEqual([{ type: "workspace", id: "workspace", projectId: "project", extensionId: "pstdio" }]);
  expect(targets).toEqual([]);
  await showDelete.run(context, {});
  expect(deleted).toEqual(["workspace", "workspace"]);
  expect(targets).toEqual([]);
});
