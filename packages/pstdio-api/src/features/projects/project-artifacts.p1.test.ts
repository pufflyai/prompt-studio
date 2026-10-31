import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { restoreProjectArtifacts } from "./project-artifacts";

test.each(["read", "none"] as const)("project setup preserves local providers with %s file access", async (files) => {
  const root = await mkdtemp(join(tmpdir(), "project-file-access-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Provided folder" });
    const workspace = await app.deps.workspaceService.ensureDefault({
      project_id: project.id,
      name: "Project folder",
      root_path: root,
    });
    const capabilities = { files, diff: false, merge: false, rebase: false, delete: false };
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_state: "ready",
      execution_kind: "local",
      root_path: root,
      provider_capabilities_json: capabilities,
    });
    await app.deps.workspaceService.setInitializing(workspace.id, true);
    await restoreProjectArtifacts(app.deps, project.id, workspace.id);
    expect((await app.deps.workspaceService.get(workspace.id))?.provider_capabilities_json).toEqual(capabilities);
    expect(await Bun.file(join(root, ".pstdio/extension-storage")).exists()).toBe(false);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
