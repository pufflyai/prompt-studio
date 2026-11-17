import { expect, test } from "bun:test";
import { parsePageUrl } from "pstdio-api-contracts";
import { makeWorkspace } from "@/features/workspaces/workspace.test-fixture";
import { createHandler } from "./file-link";

test("file links use configured ordinary pages and their declared document paths", async () => {
  const workspace = makeWorkspace({ id: "workspace-id", project_id: "project" });
  const ref = { kind: "page" as const, extensionId: "example.reader", id: "inspect" };
  const page = {
    id: "example.reader.page.inspect",
    ref,
    path: "reading-room",
    document: { metadataKey: "file" },
    params: undefined,
  };
  const outputs: string[] = [];
  const requests: unknown[] = [];
  let available = true;
  const handler = createHandler({
    cwd: () => "/repo",
    findProjectRoot: () => "/repo",
    readConfig: () => ({ project_id: "project" }),
    listWorkspaces: async () => [workspace],
    pages: async () => [page],
    openings: async (projectId, resources) => {
      requests.push({ projectId, resources });
      return resources.map((resource) => ({
        resource,
        ...(available
          ? {
              target: {
                kind: "page" as const,
                page: ref,
                resource: { ...resource, metadata: { file: String(resource.metadata?.workspaceFilePath) } },
              },
            }
          : {}),
      }));
    },
    log: (value) => {
      outputs.push(value);
    },
  });
  await handler({ workspace: workspace.workspace_shorthand, path: "docs/文 My %#?.md", line: 12, column: 4 });
  const { href } = JSON.parse(outputs[0]!);
  expect(parsePageUrl({ url: href, projectId: "project", pages: [page] })).toEqual({
    pageId: page.id,
    resource: {
      type: "workspace",
      id: workspace.id,
      extensionId: "pstdio",
      projectId: "project",
      metadata: { file: "docs/文 My %#?.md" },
    },
    position: { line: 12, column: 4 },
  });
  expect(requests).toHaveLength(1);
  await expect(handler({ workspace: workspace.id, path: "../secret" })).rejects.toThrow("inside the workspace root");
  available = false;
  await expect(handler({ workspace: workspace.id, path: "file.md" })).rejects.toThrow(
    "configured workspace file opener is unavailable",
  );
});
