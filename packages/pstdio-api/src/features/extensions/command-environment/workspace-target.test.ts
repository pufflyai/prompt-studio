import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import { resolveWorkspaceFilesPath } from "./workspace-files";
import { resolveLocalWorkspaceTarget } from "./workspace-target";

test("file and process access in a project without a folder on this device report the missing folder", async () => {
  const app = await createTestApp();
  try {
    // A cloud project recovered on a new device has its data but no folder yet.
    const project = await app.deps.projectService.create({ name: "Cloud notes" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });

    await expect(resolveWorkspaceFilesPath(app.deps, { projectId: project.id }, "read")).rejects.toBeInstanceOf(
      ProjectFolderMissingError,
    );
    await expect(resolveLocalWorkspaceTarget(app.deps, { projectId: project.id }, "process")).rejects.toBeInstanceOf(
      ProjectFolderMissingError,
    );
  } finally {
    await app.close();
  }
});
