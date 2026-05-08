import {
  ExtensionAlreadyInstalledError,
  formatAlreadyInstalledMessage,
  type InstallExtensionSourceInput,
  type InstalledExtensionSource,
  installExtensionSource,
} from "pstdio-api/extensions/install-extension-source";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { ensureApi } from "@/features/ensure-api";
import { installDefaultSkills } from "@/features/skills/install-default-skills";
import { type ExtensionsAddArgs, enableInstalledExtension, formatInstallOutput } from "./shared";

export const command = "add <source>";
export const describe = "Install editable extension source";

export const builder = (yargs: Argv) =>
  yargs
    .positional("source", {
      type: "string",
      demandOption: true,
      describe: "Extension name or local folder path",
    })
    .option("name", {
      type: "string",
      describe: "Install folder name",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Replace an existing install",
    })
    .option("skip-install", {
      type: "boolean",
      default: false,
      describe: "Skip dependency installation",
    });

type Deps = {
  cwd: () => string;
  enableInstalledExtension: (projectId: string, installed: InstalledExtensionSource) => Promise<unknown>;
  ensureApi: typeof ensureApi;
  findGitRoot: typeof findGitRoot;
  installExtensionSource: (input: InstallExtensionSourceInput) => Promise<InstalledExtensionSource>;
  installDefaultSkills: typeof installDefaultSkills;
  log: (message: string) => void;
  readConfig: typeof readConfig;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  enableInstalledExtension,
  ensureApi,
  findGitRoot,
  installDefaultSkills,
  installExtensionSource,
  log: console.log,
  readConfig,
};

const resolveLinkedProject = (deps: Pick<Deps, "cwd" | "findGitRoot" | "readConfig">) => {
  const root = deps.findGitRoot(deps.cwd());
  if (!root) return null;
  const projectId = deps.readConfig(root)?.project_id;
  return projectId ? { projectId, root } : null;
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ExtensionsAddArgs>) => {
    let installed: InstalledExtensionSource;
    try {
      installed = await deps.installExtensionSource({
        source: argv.source,
        installName: argv.name,
        force: argv.force,
        skipInstall: argv["skip-install"],
      });
    } catch (error) {
      if (error instanceof ExtensionAlreadyInstalledError) {
        deps.log(formatAlreadyInstalledMessage(error));
        process.exitCode = 1;
        return;
      }
      throw error;
    }

    const project = resolveLinkedProject(deps);
    if (!project) {
      deps.log(formatInstallOutput(installed, { state: "skipped" }));
      return;
    }

    await deps.ensureApi(API_URL);
    await deps.enableInstalledExtension(project.projectId, installed);
    await deps.installDefaultSkills(project.root, project.projectId);
    deps.log(formatInstallOutput(installed, { state: "enabled", projectId: project.projectId }));
  };

export const handler = createHandler();
