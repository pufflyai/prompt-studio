import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionCommandRecord } from "pstdio-api-contracts";
import type { RuntimeCommandRecord } from "pstdio-extensions";
import { loadExtensionSources, normalizeExtensionSources } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../services/extension-service";
import type { ExtensionsRouteDeps } from "./deps";

export { createCommandEnvironment } from "./command-environment";

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) throw new ProjectNotFoundError(projectId);
  const enabledSources = await deps.extensionService.listEnabledSourcesForProject(projectId);
  const loadableSources = enabledSources.filter(({ installedSource }) =>
    existsSync(join(installedSource.source_path, "package.json")),
  );
  const repos = await deps.repoService.listByProject(projectId);
  const loaded = await loadExtensionSources({
    extensionPackages: loadableSources.map(({ installedSource }) => ({
      path: installedSource.source_path,
      sourceKind: installedSource.source_kind,
    })),
  });

  const runtime = normalizeExtensionSources(loaded.sources, loaded.diagnostics, {
    repoRoots: repos.map((repo) => repo.path).sort((left, right) => left.localeCompare(right)),
  });
  return {
    project: { id: project.id, name: project.name, shorthand: project.shorthand },
    enabledSources,
    runtime,
  };
};

// Loads one installed source's runtime regardless of its enabled state, so the
// dashboard can document what a disabled extension would contribute.
export const loadInstalledSourceRuntime = async (installedSource: {
  source_path: string;
  source_kind: "local_path" | "git" | "registry";
}) => {
  const loaded = await loadExtensionSources({
    extensionPackages: [{ path: installedSource.source_path, sourceKind: installedSource.source_kind }],
  });
  return normalizeExtensionSources(loaded.sources, loaded.diagnostics, { repoRoots: [] });
};

export const toCommandRecord = (command: RuntimeCommandRecord): ExtensionCommandRecord => ({
  id: command.id,
  extensionId: command.extensionId,
  title: command.title,
  description: command.description,
  cliPath: command.cli?.pathKey,
  cliAliases: command.cli?.globalAliases?.map((alias) => alias.join(" ")),
  examples: command.cli?.examples,
  params: command.params as ExtensionCommandRecord["params"],
});
