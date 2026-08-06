import type {
  ListProjectExtensionsResponse,
  ResetProjectExtensionLayoutRequest,
  ResetProjectExtensionLayoutResponse,
} from "@pstdio/sdk/api";
import type { Arguments, Argv } from "yargs";
import { apiClient } from "@/features/api-client";
import { findGitRoot, readConfig } from "@/features/config/config";

export const command = "reset-layout <extension>";
export const describe = "Reset persisted dashboard layouts owned by an extension";

export interface ExtensionsResetLayoutArgs {
  extension: string;
  mode?: string;
  "project-id"?: string;
}

export const builder = (yargs: Argv) =>
  yargs
    .positional("extension", {
      type: "string",
      demandOption: true,
      describe: "Extension id, name, or install name",
    })
    .option("project-id", {
      type: "string",
      describe: "Project id (defaults to the linked project)",
    })
    .option("mode", {
      type: "string",
      describe: "Limit the reset to one workbench mode",
    });

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  listProjectExtensions: (projectId: string) => Promise<ListProjectExtensionsResponse>;
  log: (message: string) => void;
  readConfig: typeof readConfig;
  resetLayout: (
    projectId: string,
    instanceId: string,
    input: ResetProjectExtensionLayoutRequest,
  ) => Promise<ResetProjectExtensionLayoutResponse>;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  listProjectExtensions: (projectId) => apiClient().extensions.listProject(projectId),
  log: console.log,
  readConfig,
  resetLayout: (projectId, instanceId, input) => apiClient().extensions.resetLayout(projectId, instanceId, input),
};

const resolveProjectId = (deps: Pick<Deps, "cwd" | "findGitRoot" | "readConfig">, explicit?: string) => {
  if (explicit) return explicit;
  const root = deps.findGitRoot(deps.cwd());
  const projectId = root ? deps.readConfig(root)?.project_id : undefined;
  if (!projectId) throw new Error("Run inside a linked project or pass --project-id.");
  return projectId;
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsResetLayoutArgs>) => {
    const projectId = resolveProjectId(deps, argv["project-id"]);
    const { extensions } = await deps.listProjectExtensions(projectId);
    const extension = extensions.find(
      (candidate) =>
        candidate.extensionId === argv.extension ||
        candidate.installName === argv.extension ||
        candidate.name === argv.extension,
    );
    if (!extension) throw new Error(`Extension not found in project ${projectId}: ${argv.extension}`);

    const result = await deps.resetLayout(projectId, extension.id, argv.mode ? { modeId: argv.mode } : {});
    deps.log(
      [
        "Extension layout reset accepted.",
        `  Extension: ${extension.installName}`,
        `  Project: ${result.projectId}`,
        `  Mode: ${result.modeId ?? "all"}`,
        `  Revision: ${result.revision}`,
        "  Cleared: matching extension-owned persisted placements",
      ].join("\n"),
    );
  };

export const handler = createHandler();
