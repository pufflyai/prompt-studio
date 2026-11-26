import type {
  ListProjectExtensionsResponse,
  ProjectExtensionInstance,
  UpgradeProjectExtensionResponse,
} from "@pstdio/sdk/api";
import { PstdioApiError } from "@pstdio/sdk/client";
import {
  createExtensionUpgradePool,
  extensionUpgradeNeedsReviewCode,
  selectExtensionUpgradeCandidates,
} from "pstdio-api-contracts/extension-host";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import {
  deprecatedProjectExtensionSelector,
  selectProjectExtensions,
} from "@/features/extensions/project-extension-selectors";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "update [name]";
export const describe = "Install the newest compatible release of managed extensions";

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
  warn?: (message: string) => void;
  resolveProjectId: typeof resolveProjectId;
  upgradeProjectExtension: (projectId: string, instanceId: string) => Promise<UpgradeProjectExtensionResponse>;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  listProjectExtensions: (projectId) => apiClient().extensions.listProject(projectId),
  log: console.log,
  warn: console.error,
  resolveProjectId,
  upgradeProjectExtension: (projectId, instanceId) => apiClient().extensions.upgradeProject(projectId, instanceId),
};

const formatUpdated = (extension: ProjectExtensionInstance) =>
  `Updated ${extension.installName}${extension.version ? ` to ${extension.version}` : ""}.`;

const runUpdates = async (deps: Deps, projectId: string, extensions: ProjectExtensionInstance[], capacity?: number) => {
  const run = createExtensionUpgradePool(capacity);
  await Promise.all(
    extensions.map((extension) =>
      run(async () => {
        try {
          const result = await deps.upgradeProjectExtension(projectId, extension.id);
          deps.log(formatUpdated(result.extension));
        } catch (error) {
          const label =
            error instanceof PstdioApiError && error.code === extensionUpgradeNeedsReviewCode
              ? "LOCAL FILES KEPT"
              : "ERROR";
          const message = error instanceof Error ? error.message : String(error);
          deps.log(`${label}: ${extension.installName}: ${message}`);
          if (label === "LOCAL FILES KEPT")
            (deps.warn ?? console.error)(
              `Open Extensions to review the upgrade, or run pst extensions review begin ${extension.installName}.`,
            );
          process.exitCode = 1;
        }
      }),
    ),
  );
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsUpdateArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);
    const { extensions, upgradeConcurrency } = await deps.listProjectExtensions(projectId);
    const installed = argv.name ? selectProjectExtensions(extensions, argv.name) : extensions;
    if (argv.name && installed.length === 0) {
      throw new Error(`Extension "${argv.name}" is not installed in project ${projectId}.`);
    }

    const notice = argv.name && installed[0] && deprecatedProjectExtensionSelector(installed[0], argv.name);
    if (notice) (deps.warn ?? console.error)(notice);
    const candidates = selectExtensionUpgradeCandidates(installed);
    if (candidates.length === 0) {
      deps.log(
        argv.name
          ? `No host-managed update is available for "${argv.name}".`
          : "All managed extensions are up to date.",
      );
      return;
    }

    await runUpdates(deps, projectId, candidates, upgradeConcurrency);
  };

export const handler = createHandler();
