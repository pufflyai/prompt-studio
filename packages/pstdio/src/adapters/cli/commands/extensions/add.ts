import { homedir } from "node:os";
import {
  ExtensionInstallError,
  type InstallExtensionDeps,
  type InstallExtensionInput,
  type InstallExtensionResult,
  installExtensionSource,
  type PackageManager,
} from "pstdio-extensions";
import type { Arguments, Argv } from "yargs";
import { setupProjectExtension as defaultSetupProjectExtension } from "@/features/extensions/api/setup-project-extension";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";

const SUPPORTED_PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "bun"] as const;

export const command = "add <source>";
export const describe = "Install an extension from a local folder or the Prompt Studio repo";

export const builder = (yargs: Argv) =>
  yargs
    .positional("source", {
      type: "string",
      demandOption: true,
      describe: "Named extension or path to a local folder containing an extension.ts",
    })
    .option("name", {
      type: "string",
      describe: "Override the install folder name",
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Replace an existing install at the target path",
    })
    .option("ref", {
      type: "string",
      describe: "Repo ref (branch, tag, sha) for named extension fetches",
    })
    .option("install", {
      type: "string",
      choices: [...SUPPORTED_PACKAGE_MANAGERS],
      describe: "Force a specific package manager (overrides detection)",
    })
    .option("skip-install", {
      type: "boolean",
      default: false,
      describe: "Skip installing dependencies in the copied extension folder",
    })
    .option("project-id", {
      type: "string",
      describe: "Project to enable the extension for. Defaults to the linked project in the current repo.",
    });

type AddArgs = {
  source: string;
  name?: string;
  force?: boolean;
  ref?: string;
  install?: PackageManager;
  skipInstall?: boolean;
  projectId?: string;
};

type Deps = {
  install: (input: InstallExtensionInput, deps?: InstallExtensionDeps) => Promise<InstallExtensionResult>;
  log: (msg: string) => void;
  err: (msg: string) => void;
  exit: (code: number) => void;
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  setupProjectExtension: typeof defaultSetupProjectExtension;
};

const defaultDeps: Deps = {
  install: installExtensionSource,
  log: (msg) => process.stdout.write(msg),
  err: (msg) => process.stderr.write(msg),
  exit: (code) => process.exit(code),
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  setupProjectExtension: defaultSetupProjectExtension,
};

const presentPath = (path: string) => {
  const home = homedir();
  if (home && path.startsWith(home)) return `~${path.slice(home.length)}`;
  return path;
};

const setupCurrentProject = async (deps: Deps, argv: Arguments<AddArgs>, result: InstallExtensionResult) => {
  let projectId: string | null = null;
  try {
    projectId = deps.resolveProjectId(deps.cwd(), argv.projectId).projectId;
  } catch {
    if (argv.projectId) throw new Error(`Project not found: ${argv.projectId}`);
  }
  if (!projectId) return null;

  try {
    return await deps.setupProjectExtension(projectId, result.installName);
  } catch (error) {
    if (argv.projectId) throw error;
    deps.err(`Installed extension, but project setup was skipped: ${error instanceof Error ? error.message : error}\n`);
    return null;
  }
};

const formatDependencyInstall = (result: InstallExtensionResult) => {
  const lines: string[] = [];
  if (result.dependencyInstall.ran) {
    lines.push(`Dependencies installed with ${result.dependencyInstall.manager}: ${result.dependencyInstall.command}`);
  } else if (result.dependencyInstall.reason === "skipped") {
    lines.push("Skipped dependency installation.");
    lines.push("This extension may not load until dependencies are installed:");
    lines.push(`  cd ${presentPath(result.installPath)}`);
    lines.push("  npm install");
  }
  return lines;
};

const formatSuccessReport = (result: InstallExtensionResult) => {
  const lines: string[] = [];
  lines.push("Installed extension");
  lines.push("");

  if (result.extension) {
    lines.push(`Name:       ${result.extension.displayName}`);
    lines.push(`ID:         ${result.extension.id}`);
    lines.push(`Namespace:  ${result.extension.namespace}`);
    if (result.extension.version) lines.push(`Version:    ${result.extension.version}`);
  } else {
    lines.push(`Name:       ${result.installName}`);
  }
  lines.push(`Source:     ${presentPath(result.installPath)}`);
  lines.push("");

  const depLines = formatDependencyInstall(result);
  if (depLines.length > 0) {
    lines.push(...depLines);
    lines.push("");
  }

  lines.push("Diagnostics:");
  lines.push(`  Errors:   ${result.errorCount}`);
  lines.push(`  Warnings: ${result.warningCount}`);
  lines.push("");
  lines.push("Run:");
  lines.push("  pstdio extensions check");

  return `${lines.join("\n")}\n`;
};

const formatFailureReport = (source: string, error: unknown) => {
  const lines: string[] = [];
  lines.push("Failed to install extension");
  lines.push("");
  lines.push("Source:");
  lines.push(`  ${source}`);
  lines.push("");
  lines.push("Reason:");
  if (error instanceof ExtensionInstallError) {
    for (const line of error.message.split("\n")) lines.push(`  ${line}`);
  } else if (error instanceof Error) {
    lines.push(`  ${error.message}`);
  } else {
    lines.push(`  ${String(error)}`);
  }
  return `${lines.join("\n")}\n`;
};

export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (argv: Arguments<AddArgs>) => {
    const allDeps = { ...defaultDeps, ...deps };
    try {
      const result = await allDeps.install({
        source: argv.source,
        installName: argv.name,
        force: argv.force,
        ref: argv.ref,
        packageManager: argv.install,
        skipInstall: argv.skipInstall,
      });
      allDeps.log(formatSuccessReport(result));
      const setup = await setupCurrentProject(allDeps, argv, result);
      if (setup) {
        allDeps.log(`Enabled for project. Installed skills for ${setup.installedSkills.length} extension skill(s).\n`);
      }
    } catch (error) {
      allDeps.err(formatFailureReport(argv.source, error));
      allDeps.exit(1);
    }
  };

export const handler = createHandler();
