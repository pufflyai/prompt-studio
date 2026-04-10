import type { Arguments } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { registerPlugins as defaultRegisterPlugins } from "@/features/projects/api/register-plugins";
import { addProjectIdOption, formatPluginOutput, type PluginsArgs, resolveProjectId } from "./shared";

export const command = "register";
export const describe = "Force plugin registration for a project";

export const builder = addProjectIdOption;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  registerPlugins: typeof defaultRegisterPlugins;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  registerPlugins: defaultRegisterPlugins,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<PluginsArgs>) => {
    const projectId = resolveProjectId(deps, argv["project-id"]);
    const result = await deps.registerPlugins(projectId);
    deps.log(formatPluginOutput(result));
  };

export const handler = createHandler();
