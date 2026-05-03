import type { Arguments, Argv } from "yargs";
import { setupProjectExtension as defaultSetupProjectExtension } from "@/features/extensions/api/setup-project-extension";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";

export const command = "enable <install-name>";
export const describe = "Enable an installed extension for the current project";

export const builder = (yargs: Argv) =>
  yargs
    .positional("install-name", {
      type: "string",
      demandOption: true,
      describe: "Installed extension folder name under ~/.pstdio/extensions",
    })
    .option("project-id", {
      type: "string",
      describe: "Project to enable the extension for. Defaults to the linked project in the current repo.",
    });

type EnableArgs = {
  installName: string;
  projectId?: string;
};

type Deps = {
  log: (msg: string) => void;
  err: (msg: string) => void;
  exit: (code: number) => void;
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  setupProjectExtension: typeof defaultSetupProjectExtension;
};

const defaultDeps: Deps = {
  log: (msg) => process.stdout.write(msg),
  err: (msg) => process.stderr.write(msg),
  exit: (code) => process.exit(code),
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  setupProjectExtension: defaultSetupProjectExtension,
};

const formatFailure = (installName: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to enable extension\n\nExtension:\n  ${installName}\n\nReason:\n  ${message}\n`;
};

export const createHandler =
  (deps: Partial<Deps> = {}) =>
  async (argv: Arguments<EnableArgs>) => {
    const allDeps = { ...defaultDeps, ...deps };

    try {
      const { projectId } = allDeps.resolveProjectId(allDeps.cwd(), argv.projectId);
      const setup = await allDeps.setupProjectExtension(projectId, argv.installName);
      allDeps.log(`Enabled extension ${setup.installName} for project.\n`);
      allDeps.log(`Installed skills for ${setup.installedSkills.length} extension skill(s).\n`);
    } catch (error) {
      allDeps.err(formatFailure(argv.installName, error));
      allDeps.exit(1);
    }
  };

export const handler = createHandler();
