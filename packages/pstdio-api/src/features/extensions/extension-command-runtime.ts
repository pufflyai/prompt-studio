import type { ExtensionCommandRecord } from "pstdio-api-contracts";
import type { RuntimeCommandRecord } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../services/extension-service";
import type { ExtensionsRouteDeps } from "./deps";

export { createCommandEnvironment } from "./command-environment";

export const loadProjectExtensionRuntime = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const project = await deps.projectService.get(projectId);
  if (!project) throw new ProjectNotFoundError(projectId);
  const { enabledSources, runtime } = await deps.extensionRuntimeCatalog.getProjectRuntime(projectId);
  return {
    project: { id: project.id, name: project.name, shorthand: project.shorthand },
    enabledSources,
    runtime,
  };
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
