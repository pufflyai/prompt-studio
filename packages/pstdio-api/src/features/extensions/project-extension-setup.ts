import { basename, dirname } from "node:path";
import type { NormalizedExtension } from "pstdio-extensions";
import type { RuntimeSkillRecord } from "pstdio-extensions/types";
import type { RouteDeps } from "../deps";
import { installExtensionSkillsForProject } from "../skills/agent-install";

type SetupProjectExtensionInput = {
  projectId: string;
  installName: string;
};

const manifestForExtension = (extension: NormalizedExtension) => ({
  id: extension.id,
  namespace: extension.namespace,
  displayName: extension.displayName,
  version: extension.version,
});

const findExtensionByInstallName = (extensions: NormalizedExtension[], installName: string) =>
  extensions.find((extension) => basename(dirname(extension.sourcePath)) === installName) ?? null;

const upsertInstalledSource = async (
  deps: RouteDeps,
  input: { installName: string; extension: NormalizedExtension },
) => {
  const existing = await deps.extensionService.installedSources.getByInstallName(input.installName);
  if (existing) {
    const updated = await deps.extensionService.installedSources.update(existing.id, {
      display_name: input.extension.displayName,
      version: input.extension.version ?? null,
      source_kind: input.extension.sourceKind,
      manifest_json: manifestForExtension(input.extension),
      last_loaded_at: new Date().toISOString(),
      last_error_json: null,
    });
    return updated ?? existing;
  }

  return deps.extensionService.installedSources.create({
    install_name: input.installName,
    extension_id: input.extension.id,
    namespace: input.extension.namespace,
    display_name: input.extension.displayName,
    version: input.extension.version ?? null,
    source_path: dirname(input.extension.sourcePath),
    source_kind: input.extension.sourceKind,
    manifest_json: manifestForExtension(input.extension),
  });
};

const upsertProjectInstance = async (
  deps: RouteDeps,
  input: { projectId: string; installedSourceId: string; extension: NormalizedExtension },
) => {
  const existing = await deps.extensionService.projectInstances.getByExtensionId(input.projectId, input.extension.id);
  if (existing) {
    return deps.extensionService.projectInstances.update(existing.id, {
      display_name: input.extension.displayName,
      enabled: true,
      diagnostics_json: null,
    });
  }

  return deps.extensionService.projectInstances.create({
    project_id: input.projectId,
    installed_extension_id: input.installedSourceId,
    extension_id: input.extension.id,
    namespace: input.extension.namespace,
    display_name: input.extension.displayName,
    enabled: true,
  });
};

const extensionSkills = (records: RuntimeSkillRecord[], extensionId: string) =>
  records.filter((record) => record.extensionId === extensionId);

export const setupProjectExtension = async (deps: RouteDeps, input: SetupProjectExtensionInput) => {
  const project = await deps.projectService.get(input.projectId);
  if (!project) return { error: "project_not_found" as const };

  const checkResult = await deps.extensionService.check();
  const extension = findExtensionByInstallName(checkResult.runtime.extensions, input.installName);
  if (!extension) return { error: "extension_not_found" as const };

  const installedSource = await upsertInstalledSource(deps, { installName: input.installName, extension });
  const projectInstance = await upsertProjectInstance(deps, {
    projectId: input.projectId,
    installedSourceId: installedSource.id,
    extension,
  });

  const skills = extensionSkills(checkResult.runtime.skills, extension.id);
  const installedSkills = await installExtensionSkillsForProject(deps, input.projectId, skills);

  deps.eventBus.emit("installed_extension_sources", "set", installedSource);
  if (projectInstance) deps.eventBus.emit("project_extension_instances", "set", projectInstance);

  return {
    extension,
    installedSource,
    projectInstance,
    installedSkills: skills.map((skill) => ({
      id: skill.id,
      extensionId: skill.extensionId,
      skillKey: skill.localId,
      installedAgents: installedSkills.get(skill.id) ?? [],
    })),
  };
};
