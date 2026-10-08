import { expect, test } from "bun:test";
import { parsePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import { makeWorkspace } from "@/features/workspaces/workspace.test-fixture";
import { createHandler } from "./file-link";

test("generates a document URL by workspace identity without reading or writing files", async () => {
  const workspace = makeWorkspace({ id: "workspace-id", project_id: "project" });
  const outputs: string[] = [];
  const handler = createHandler({
    cwd: () => "/repo",
    findProjectRoot: () => "/repo",
    readConfig: () => ({ project_id: "project" }),
    listWorkspaces: async () => [workspace],
    log: (value) => outputs.push(value),
  });
  for (const value of [workspace.id, workspace.workspace_shorthand]) {
    await handler({ workspace: value, path: "docs/文 My %#?.md", line: 12, column: 4 });
    const { href } = JSON.parse(outputs.at(-1)!);
    expect(
      parsePageUrl({
        url: href,
        projectId: "project",
        pages: [
          {
            id: "workspace",
            ref: workbenchPages.workspace,
            path: "workspace",
            document: { metadataKey: "workspaceFilePath" },
          },
        ],
      }),
    ).toEqual({
      pageId: "workspace",
      resource: { type: "workspace", id: workspace.id, metadata: { workspaceFilePath: "docs/文 My %#?.md" } },
      position: { line: 12, column: 4 },
    });
  }
  expect(outputs[0]).toBe(outputs[1]);
  await expect(handler({ workspace: workspace.id, path: "../secret" })).rejects.toThrow();
});
