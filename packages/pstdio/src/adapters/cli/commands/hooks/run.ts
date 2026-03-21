import type { HookContext, HookName } from "pstdio-wt";
import { runHook as defaultRunHook } from "pstdio-wt";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";

export const command = "run <hook>";
export const describe = "Manually run a hook script";

export const builder = (yargs: Argv) =>
  yargs
    .positional("hook", { type: "string", demandOption: true, describe: "Hook name (e.g. pre-commit)" })
    .option("worktree-path", { type: "string", describe: "Worktree path to run hook in" });

type RunArgs = {
  hook: string;
  "worktree-path"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  runHook: typeof defaultRunHook;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  runHook: defaultRunHook,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<RunArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const hookName = argv.hook as HookName;
    const context: HookContext = {
      repoPath: root,
      worktreePath: argv["worktree-path"] ?? deps.cwd(),
      projectId: config.project_id,
    };

    const result = await deps.runHook(hookName, context, root);

    if (result.skipped) {
      deps.log(`No hook script found for "${hookName}".`);
      return;
    }

    if (result.stdout) deps.log(result.stdout.trimEnd());
    if (result.stderr) deps.log(result.stderr.trimEnd());

    if (result.exitCode !== 0) {
      throw new Error(`HOOK ${hookName} FAILED (exit ${result.exitCode})`);
    }
  };

export const handler = createHandler();
