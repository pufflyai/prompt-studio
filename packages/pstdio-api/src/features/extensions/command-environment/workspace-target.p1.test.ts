import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { expectRejection } from "../../../test-utils/expect-rejection";
import { ProjectFolderMissingError } from "../../projects/project-folder-missing";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";
import { createWorkspaceFileMount, resolveWorkspaceFilesPath } from "./workspace-files";
import { resolveLocalWorkspaceTarget } from "./workspace-target";

test("file and process access in a project without a folder on this device report the missing folder", async () => {
  const app = await createTestApp();
  try {
    // A cloud project recovered on a new device has its data but no folder yet.
    const project = await app.deps.projectService.create({ name: "Cloud notes" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder" });

    await expectRejection(resolveWorkspaceFilesPath(app.deps, { projectId: project.id }, "read")).toBeInstanceOf(
      ProjectFolderMissingError,
    );
    await expectRejection(resolveLocalWorkspaceTarget(app.deps, { projectId: project.id }, "process")).toBeInstanceOf(
      ProjectFolderMissingError,
    );
  } finally {
    await app.close();
  }
});

test("ready workspace maintenance retains file authority for editor and agent projections", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-ready-maintenance-"));
  writeFileSync(join(root, "notes.md"), "Recovered document");
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  let maintenance: Promise<void> | undefined;
  try {
    const project = await app.deps.projectService.create({ name: "Shared document" });
    await app.deps.workspaceService.ensureDefault({
      project_id: project.id,
      name: "Project folder",
      root_path: root,
    });
    maintenance = provisionProjectWorkspaces(app.deps, project.id, {
      ensureConfig: async () => {},
      fireProvision: async () => {
        entered.resolve();
        await finish.promise;
        return { delivered: 0 };
      },
      fireReadyAsync: () => {},
    });
    await entered.promise;
    // An already usable source keeps its authority while background skill files are refreshed.
    const files = createWorkspaceFileMount((access) =>
      resolveWorkspaceFilesPath(app.deps, { projectId: project.id }, access),
    );
    expect(await files.readText("notes.md")).toBe("Recovered document");
    await files.writeText("notes.md", "Recovered document: agent");
    expect(await files.readText("notes.md")).toBe("Recovered document: agent");
  } finally {
    finish.resolve();
    await maintenance;
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
