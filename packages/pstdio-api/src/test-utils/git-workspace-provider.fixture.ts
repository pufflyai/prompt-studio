import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { createTestApp } from "./create-test-app";

export const enableGitWorkspaceProvider = async (
  handle: Pick<Awaited<ReturnType<typeof createTestApp>>, "app">,
  projectId: string,
) => {
  const sourcePath = resolve(import.meta.dir, "../../../../extensions/git-workspaces");
  const manifest = JSON.parse(await readFile(resolve(sourcePath, "package.json"), "utf8"));
  const response = await handle.app.request(`/v1/projects/${projectId}/extensions/installed/git-workspaces/enable`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "git-workspaces", displayName: "Git workspaces", extensionId: "pstdio.git-workspaces", manifest,
      sourcePath, sourceHash: null, sourceKind: "local_path", sourceRef: null, version: manifest.version,
    }),
  });
  if (response.status !== 200) throw new Error(`Cannot enable Git workspace fixture: ${await response.text()}`);
};
