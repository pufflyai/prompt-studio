import type {
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  UpgradeProjectExtensionResponse,
} from "@pstdio/sdk/api";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "update [name]";
export const describe = "Update managed extensions to the release matching this host";

export const builder = (yargs: Argv) =>
  yargs
    .positional("name", {
      type: "string",
      describe: "Extension install name; updates every available extension when omitted",
    })
    .option("project-id", {
      type: "string",
      describe: "Project ID",
    });

export type ExtensionsUpdateArgs = {
  name?: string;
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  listProjectExtensions: (projectId: string) => Promise<ListProjectExtensionsResponse>;
  log: (message: string) => void;
  resolveProjectId: typeof resolveProjectId;
  upgradeProjectExtension: (projectId: string, instanceId: string) => Promise<UpgradeProjectExtensionResponse>;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  listProjectExtensions: (projectId) => apiClient().extensions.listProject(projectId),
  log: console.log,
  resolveProjectId,
  upgradeProjectExtension: (projectId, instanceId) => apiClient().extensions.upgradeProject(projectId, instanceId),
};

const formatUpdated = (extension: ProjectExtensionInstance) =>
  `Updated ${extension.installName}${extension.version ? ` to ${extension.version}` : ""}.`;

const runUpdates = async (deps: Deps, projectId: string, extensions: ProjectExtensionInstance[]) => {
  for (const extension of extensions) {
    try {
      const result = await deps.upgradeProjectExtension(projectId, extension.id);
      deps.log(formatUpdated(result.extension));
    } catch (error) {
      deps.log(`ERROR: ${extension.installName}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsUpdateArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);
    const { extensions } = await deps.listProjectExtensions(projectId);
    const installed = argv.name ? extensions.filter((extension) => extension.installName === argv.name) : extensions;
    if (argv.name && installed.length === 0) {
      throw new Error(`Extension "${argv.name}" is not installed in project ${projectId}.`);
    }

    const candidates = installed.filter((extension) => extension.canUpgrade);
    if (candidates.length === 0) {
      deps.log(
        argv.name
          ? `No host-managed update is available for "${argv.name}".`
          : "All host-managed extensions already match this Prompt Studio release.",
      );
      return;
    }

    await runUpdates(deps, projectId, candidates);
  };

export const handler = createHandler();
