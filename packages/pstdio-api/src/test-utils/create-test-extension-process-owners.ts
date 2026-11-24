import { createExtensionProcessOwners } from "../features/extensions/extension-process-owners";
import type { ProcessEnvironmentSource } from "../features/extensions/process-environment/permissions";

type TestEnabledSource = {
  installedSource: Pick<ProcessEnvironmentSource, "extension_id" | "source_path"> &
    Partial<Pick<ProcessEnvironmentSource, "source_hash" | "manifest_json">>;
};

export const createTestExtensionProcessOwners = (
  listEnabledSources: (projectId: string) => readonly TestEnabledSource[] | Promise<readonly TestEnabledSource[]>,
) =>
  createExtensionProcessOwners({
    findEnabledSource: async (projectId, extensionId) => {
      const enabled = await listEnabledSources(projectId);
      const source = enabled.find(
        ({ installedSource }) => installedSource.extension_id === extensionId,
      )?.installedSource;
      if (source)
        return { ...source, source_hash: source.source_hash ?? null, manifest_json: source.manifest_json ?? {} };
    },
  });
