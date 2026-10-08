import { expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { parsePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import { PACKAGED_BINARY_PATH } from "./packaged-helpers";

export const expectPackagedWorkspaceFileLink = async (input: {
  baseUrl: string;
  projectId: string;
  projectRoot: string;
  home: string;
  headers: Record<string, string>;
}) => {
  const response = await fetch(`${input.baseUrl}/v1/workspaces?project_id=${input.projectId}`, {
    headers: input.headers,
  });
  expect(response.status).toBe(200);
  const [workspace] = (await response.json()) as { id: string; workspace_shorthand: string }[];
  const result = spawnSync(
    PACKAGED_BINARY_PATH,
    [
      "workspaces",
      "file-link",
      "--workspace",
      workspace!.workspace_shorthand,
      "--path",
      "src/a #%.ts",
      "--line",
      "12",
      "--column",
      "4",
    ],
    {
      cwd: input.projectRoot,
      env: { ...process.env, PSTDIO_HOME: input.home },
      encoding: "utf8",
    },
  );
  expect(result.status).toBe(0);
  const { href } = JSON.parse(result.stdout);
  expect(
    parsePageUrl({
      url: href,
      projectId: input.projectId,
      pages: [
        {
          id: "workspace",
          ref: workbenchPages.workspace,
          path: "workspace",
          document: { metadataKey: "workspaceFilePath" },
        },
      ],
    }),
  ).toMatchObject({
    resource: { id: workspace!.id, metadata: { workspaceFilePath: "src/a #%.ts" } },
    position: { line: 12, column: 4 },
  });
};
