import type { createExtensionInstancesDBService } from "pstdio-db";
import { loadExtensionRuntime } from "pstdio-extensions";
import type { createRepoService } from "./repo-service";

export type ExtensionRegistryRuntime = Awaited<ReturnType<typeof loadExtensionRuntime>>;

type ExtensionRegistryRuntimeDeps = {
  extensionInstancesDBService: Pick<ReturnType<typeof createExtensionInstancesDBService>, "list">;
  filesRoot: string;
  repoService: ReturnType<typeof createRepoService>;
};

const filterDisabledExtensions = (runtime: ExtensionRegistryRuntime, disabledExtensionIds: Set<string>) => {
  if (disabledExtensionIds.size === 0) return runtime;

  const isEnabled = (extensionId: string) => !disabledExtensionIds.has(extensionId);

  return {
    ...runtime,
    extensions: runtime.extensions.filter((extension) => isEnabled(extension.id)),
    commands: runtime.commands.filter((command) => isEnabled(command.extensionId)),
    cli: runtime.cli.filter((contribution) => isEnabled(contribution.extensionId)),
    events: runtime.events.filter((event) => isEnabled(event.extensionId)),
    views: runtime.views.filter((view) => isEnabled(view.extensionId)),
    artifactMounts: runtime.artifactMounts.filter((mount) => isEnabled(mount.extensionId)),
    templateTypes: runtime.templateTypes.filter((templateType) => isEnabled(templateType.extensionId)),
    templates: runtime.templates.filter((template) => isEnabled(template.extensionId)),
    skills: runtime.skills.filter((skill) => isEnabled(skill.extensionId)),
    harnesses: runtime.harnesses.filter((harness) => isEnabled(harness.extensionId)),
  };
};

export const loadProjectExtensionRuntime = async (deps: ExtensionRegistryRuntimeDeps, projectId: string) => {
  const [repo] = await deps.repoService.listByProject(projectId);
  const runtime = repo
    ? await loadExtensionRuntime({ projectRoot: repo.path })
    : await loadExtensionRuntime({ projectRoot: deps.filesRoot || process.cwd(), includeLocal: false });
  const instances = await deps.extensionInstancesDBService.list(projectId);
  const disabledExtensionIds = new Set(
    instances.filter((instance) => !instance.enabled).map((instance) => instance.extension_id),
  );

  return filterDisabledExtensions(runtime, disabledExtensionIds);
};

export const findExtensionSourcePath = (runtime: ExtensionRegistryRuntime, extensionId: string) =>
  runtime.extensions.find((extension) => extension.id === extensionId)?.sourcePath;
