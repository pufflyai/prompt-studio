import { existsSync } from "node:fs";
import { canonicalExtensionId, historicalExtensionId } from "pstdio-api-contracts/extension-identity";
import { migrateExtensionFiles } from "pstdio-extensions";
import type { createWorkspaceService } from "../../services/workspace-service";

export const migrateRuntimeExtensionFiles = async (
  workspaces: Pick<ReturnType<typeof createWorkspaceService>, "list">,
  projectId: string,
  sources: { installedSource: { extension_id: string } }[],
) => {
  const conflicts = new Map<string, string>();
  const renamedSources = sources.filter(({ installedSource }) => {
    const owner = canonicalExtensionId(installedSource.extension_id);
    return historicalExtensionId(owner) !== owner;
  });
  for (const candidate of renamedSources.length ? await workspaces.list(projectId) : []) {
    const files = candidate.provider_capabilities_json?.files;
    if (
      candidate.execution_kind === "local" &&
      candidate.root_path &&
      !candidate.deleted_at &&
      (!files || files === "write") &&
      existsSync(candidate.root_path)
    ) {
      for (const { installedSource } of renamedSources) {
        const owner = canonicalExtensionId(installedSource.extension_id);
        try {
          await migrateExtensionFiles(candidate.root_path, owner);
        } catch (error) {
          conflicts.set(owner, error instanceof Error ? error.message : String(error));
        }
      }
    }
  }
  return conflicts;
};
