import { createSharedArtifactMount } from "../../services/shared-files/artifact-mount";
import { resolveWorkspaceFilesPath } from "../extensions/command-environment/workspace-files";
import { resolveLocalWorkspaceTarget } from "../extensions/command-environment/workspace-target";
import { createPublicationStorageAccess } from "../extensions/publication/storage-access";
import type { ProjectsRouteDeps } from "./deps";

/** Restoring files is a setup phase, so only this initializing workspace may write them. */
export const restoreProjectArtifacts = async (deps: ProjectsRouteDeps, projectId: string, workspaceId: string) => {
  const target = { projectId, provisioningWorkspaceId: workspaceId };
  const { workspace } = await resolveLocalWorkspaceTarget(deps, target, "file");
  const files = workspace.provider_capabilities_json?.files;
  if (files === "read" || files === "none") return;
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  if (!snapshot.runtime.artifactMounts.length) return;
  const root = await resolveWorkspaceFilesPath(deps, target, "write");
  for (const mount of snapshot.runtime.artifactMounts) {
    const enabled = snapshot.enabledSources.find(
      ({ installedSource }) => installedSource.extension_id === mount.extensionId,
    );
    if (!enabled) continue;
    const access = createPublicationStorageAccess(deps, {
      projectId,
      extensionId: mount.extensionId,
      extensionInstanceId: enabled.instance.id,
      source: enabled.installedSource,
    });
    await access.write();
    await createSharedArtifactMount(deps, {
      projectId,
      extensionId: mount.extensionId,
      repoRoot: root,
      name: mount.name,
      mountPath: mount.relativePath,
      mountPaths: snapshot.runtime.artifactMounts
        .filter((candidate) => candidate.extensionId === mount.extensionId)
        .map((candidate) => candidate.relativePath),
      assertWritable: access.write,
      resolveWriteRoot: () => resolveWorkspaceFilesPath(deps, target, "write"),
      onWrite: (path) => deps.artifactMountWrites.record(path),
    }).refresh();
  }
};
