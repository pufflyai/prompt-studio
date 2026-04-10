import type { Arguments } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listPlugins as defaultListPlugins } from "@/features/projects/api/list-plugins";
import { addProjectIdOption, formatPluginOutput, type PluginsArgs, resolveProjectId } from "./shared";

export const command = "list";
export const describe = "List registered plugins for a project";

export const builder = addProjectIdOption;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listPlugins: typeof defaultListPlugins;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listPlugins: defaultListPlugins,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<PluginsArgs>) => {
    const projectId = resolveProjectId(deps, argv["project-id"]);
    const result = await deps.listPlugins(projectId);
    deps.log(formatPluginOutput(result));
  };

export const handler = createHandler();
