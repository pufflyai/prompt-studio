import { expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { sidebarView } from "./sidebar";

const workspace: ExtensionWorkspace = {
  id: "default",
  name: "Project",
  isDefault: true,
  executionKind: "local",
  providerState: "ready",
  capabilities: { files: "write", diff: false, delete: false, merge: false, rebase: false },
};
const nodes = async (current?: ExtensionWorkspace) => {
  if (sidebarView.body.kind !== "tree" || typeof sidebarView.body.body !== "function")
    throw new Error("Expected native tree");
  const sections = await sidebarView.body.body({
    project: { id: "project" },
    workspaces: { getDefault: async () => current },
  } as never);
  return sections[0]!.nodes;
};

test("Files opens the local project tree and retains folder selection before setup", async () => {
  expect((await nodes(workspace)).find((node) => node.id === "files")?.target).toMatchObject({
    kind: "page",
    page: { id: "files" },
  });
  expect((await nodes()).find((node) => node.id === "files")?.target).toMatchObject({ kind: "command" });
});

test("Files is unavailable when the default workspace cannot expose project files", async () => {
  expect((await nodes({ ...workspace, executionKind: "remote" })).map((node) => node.id)).toEqual(["workspaces"]);
  expect(
    (await nodes({ ...workspace, capabilities: { ...workspace.capabilities!, files: "none" } })).map((node) => node.id),
  ).toEqual(["workspaces"]);
  expect(
    (await nodes({ ...workspace, device: { ownerId: "owner", id: "other", name: "Other" } })).map((node) => node.id),
  ).toEqual(["workspaces"]);
});

test("Workspaces offers the shared creation flow in its menu", async () => {
  const entry = (await nodes(workspace)).find((node) => node.id === "workspaces")!;
  expect(entry.contextMenuActions).toContainEqual(
    expect.objectContaining({
      id: "create-workspace",
      icon: "plus",
      command: { kind: "command", extensionId: "pstdio.workspaces", id: "show-create" },
    }),
  );
});
