import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { remove, showCreate, showDelete, showDeleteEntry } from "./actions";
import { workspacePages } from "./refs";

test("deleting a file opens a confirmation dialog over the selected document", async () => {
  const targets: NavigationTarget[] = [];
  const context = {
    project: { id: "project" },
    resource: { type: "workspace", id: "workspace", metadata: { workspaceFilePath: "selected.md" } },
    workspaces: { get: async () => ({ id: "workspace", projectId: "project" }) },
    navigation: { open: (target: NavigationTarget) => targets.push(target) },
  } as unknown as Parameters<typeof showDeleteEntry.run>[0];
  await showDeleteEntry.run(context, { path: "other.md" });
  expect(targets).toEqual([
    {
      kind: "dialog",
      page: workspacePages.form,
      params: { operation: "delete-entry", "workspace-id": "workspace", path: "other.md", selected: "selected.md" },
    },
  ]);
});

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
  expect(targets).toEqual([{ kind: "dialog", page: workspacePages.create, params: {} }]);
});

test("deleting a workspace refreshes navigation without replacing another open resource", async () => {
  const targets: NavigationTarget[] = [];
  const deleted: string[] = [];
  const changes: unknown[] = [];
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
    events: {
      emit: async (event: unknown) => {
        changes.push(event);
      },
    },
    navigation: { open: (target: NavigationTarget) => targets.push(target) },
  } as unknown as Parameters<typeof remove.run>[0];
  await remove.run(context, { id: "workspace", confirmed: true });
  expect(deleted).toEqual(["workspace"]);
  expect(changes).toHaveLength(1);
  expect(targets).toEqual([]);
  await showDelete.run(context, {});
  expect(deleted).toEqual(["workspace", "workspace"]);
  expect(changes).toHaveLength(2);
  expect(targets).toEqual([]);
});
