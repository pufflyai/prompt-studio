import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers } from "../../core";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

test("host resource content follows root, lazy and continuation rows without replacing authored badges", async () => {
  const workbench = createWorkbench();
  const resource = { type: "workspace", id: "linked", projectId: "project" };
  const nodes = [{ id: "workspace", label: "Workspace", resource }];
  const content = { live: "workspace changes" };
  const registration = registerWorkbenchExtensionTreeRenderers({
    workbench,
    metadata: { ...metadata, treeRenderers: [{ ...metadata.treeRenderers[0]!, pageHandlerId: "page" }] },
    projectId: "project",
    resolveNodeResource: (value) => ({ ...value, icon: "folder" }),
    renderNodeEndContent: (value) => {
      expect(value).toEqual({ ...resource, icon: "folder" });
      return content;
    },
    executeCommand: (id) => {
      if (id === "page") return { nodes };
      if (id === metadata.treeRenderers[0]!.childrenHandlerId) return nodes;
      return [
        {
          id: "workspaces",
          nodes: [...nodes, { ...nodes[0], id: "authored", badge: { label: "Custom" } }],
          nextCursor: "older",
        },
      ];
    },
  });
  try {
    const trees = getWorkbenchRenderers(workbench);
    const sections = await trees.getBody(treeId);
    expect(sections[0]!.nodes[0]!.endContent).toBe(content);
    expect(sections[0]!.nodes[1]!.endContent).toBeUndefined();
    expect(sections[0]!.nodes[1]!.badge?.label).toBe("Custom");
    expect((await trees.getChildren(treeId, sections[0]!.nodes[0]!))[0]!.endContent).toBe(content);
    expect((await sections[0]!.nextPage!(new AbortController().signal)).nodes[0]!.endContent).toBe(content);
  } finally {
    registration.dispose();
    await workbench.dispose();
  }
});
