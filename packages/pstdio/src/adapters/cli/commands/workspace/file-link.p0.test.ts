import { expect, test } from "bun:test";
import { workspacePages } from "@pstdio/sdk/extensions";
import { parsePageUrl } from "pstdio-api-contracts";
import { makeWorkspace } from "@/features/workspaces/workspace.test-fixture";
import { createHandler } from "./file-link";

test.each([
  false,
  true,
])("generates a provider document URL without reading files (project folder: %s)", async (isDefault) => {
  const workspace = makeWorkspace({ id: "workspace-id", project_id: "project", is_default: isDefault });
  const page = isDefault ? workspacePages.files : workspacePages.workspace;
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
            id: page.id,
            ref: page,
            path: page.id,
            document: { metadataKey: "workspaceFilePath" },
          },
        ],
      }),
    ).toEqual({
      pageId: page.id,
      resource: { type: "workspace", id: workspace.id, metadata: { workspaceFilePath: "docs/文 My %#?.md" } },
      position: { line: 12, column: 4 },
    });
  }
  expect(outputs[0]).toBe(outputs[1]);
  await expect(handler({ workspace: workspace.id, path: "../secret" })).rejects.toThrow();
  workspace.device = { ownerId: "account", id: "another-device", name: "Laptop" };
  await expect(handler({ workspace: workspace.id, path: "docs/file.md" })).rejects.toThrow("Files are unavailable");
  workspace.device = undefined;
  workspace.execution_kind = "remote";
  await expect(handler({ workspace: workspace.id, path: "docs/file.md" })).rejects.toThrow("Files are unavailable");
});
