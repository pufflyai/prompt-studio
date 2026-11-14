import { expect, test } from "bun:test";
import { filesTree } from "./files";

test("ignored workspace entries stay navigable with a subdued foreground in root and child listings", async () => {
  const body = filesTree.body;
  if (body.kind !== "tree" || typeof body.body !== "function" || typeof body.children !== "function")
    throw new Error("Expected a native file tree");
  const ctx = {
    project: { id: "project" },
    workspaces: {
      get: async () => ({
        id: "workspace",
        projectId: "project",
        rootPath: "/project",
        providerState: "ready",
        capabilities: { files: "write" },
      }),
      listFiles: async () => ({
        entries: [
          { path: "debug.log", name: "debug.log", type: "file", git_ignored: true },
          { path: "README.md", name: "README.md", type: "file" },
        ],
      }),
    },
  } as never;
  const renderer = { rendererId: "file-tree", resource: { type: "workspace", id: "workspace" } };
  const sections = await body.body(ctx, { renderer });
  const children = await body.children(ctx, { renderer, node: { id: "folder", label: "folder" } });
  for (const nodes of [sections[0]!.nodes, children]) {
    expect(nodes[0]).toMatchObject({ tone: "muted", target: { kind: "page" } });
    expect(nodes[0]).not.toMatchObject({ disabled: true });
    expect(nodes[1]).not.toMatchObject({ tone: "muted" });
  }
});
