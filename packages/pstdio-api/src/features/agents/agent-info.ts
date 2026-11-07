import type { AgentInfo } from "pstdio-api-contracts";
import { instanceIcon } from "../extensions/project-extension-instance";
import { resolveHarnessName, toAvailabilityInfo } from "../harnesses/harness-registry-service";
import type { AgentsRouteDeps } from "./deps";

type Harness = Awaited<ReturnType<AgentsRouteDeps["harnessRegistry"]["list"]>>[number];
export const agentExtensionIcons = async (deps: AgentsRouteDeps, projectId?: string) => {
  const sources = projectId
    ? (await deps.extensionService.listEnabledSourcesForProject(projectId)).map((entry) => entry.installedSource)
    : await deps.installedExtensionSourcesService.list();
  return (harness: Harness) => {
    // Repo overrides can share an extension ID with a global install. Match the registered entry,
    // never a marketplace identity or a different installed version of the same extension.
    const source = sources
      .filter(
        (source) =>
          source.extension_id === harness.extensionId &&
          harness.sourcePath?.replaceAll("\\", "/").startsWith(`${source.source_path.replaceAll("\\", "/")}/`),
      )
      .sort((a, b) => b.source_path.length - a.source_path.length)[0];
    return source ? instanceIcon(source, (source.manifest_json as { icon?: string } | null)?.icon) : undefined;
  };
};
export const toAgentInfo = async (
  harness: Harness,
  projectId?: string,
  icon?: (harness: Harness) => string | undefined,
) => ({
  id: harness.id,
  name: resolveHarnessName(harness),
  extensionId: harness.extensionId,
  icon: icon?.(harness),
  availability: toAvailabilityInfo(await harness.detect({ projectId })),
  ...(harness.skills
    ? { skills: { dir: harness.skills.dir, globalDir: harness.skills.globalDir, global_dir: harness.skills.globalDir } }
    : {}),
  ...(harness.params ? { params: harness.params as AgentInfo["params"] } : {}),
  capabilities: await harness.capabilities({ projectId }),
  supportsModels: harness.supportsModels,
});
