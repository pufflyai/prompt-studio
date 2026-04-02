import type { HookName } from "pstdio-hooks";
import { listHooks as defaultListHooks } from "pstdio-hooks";
import type { Arguments, Argv } from "yargs";
import { findGitRoot } from "@/features/config/config";
import { createHookFile as defaultCreateHookFile } from "@/features/hooks/create-hook";

export const command = "create <hook>";
export const describe = "Create a hook script";

export const builder = (yargs: Argv) =>
  yargs.positional("hook", {
    type: "string",
    demandOption: true,
    describe: "Supported hook name (run 'pstdio hooks list' to see all names)",
  });

type CreateArgs = {
  hook: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  listHooks: typeof defaultListHooks;
  createHookFile: typeof defaultCreateHookFile;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  listHooks: defaultListHooks,
  createHookFile: defaultCreateHookFile,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const hook = deps.listHooks(root).find((entry) => entry.name === argv.hook);
    if (!hook) {
      throw new Error(`Unsupported hook: "${argv.hook}"`);
    }

    await deps.createHookFile(root, hook.name as HookName);
    deps.log(`Created hook "${hook.name}" at .pstdio/hooks/${hook.name}`);
  };

export const handler = createHandler();
