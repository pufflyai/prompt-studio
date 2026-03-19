import { listHooks as defaultListHooks } from "pstdio-wt";
import type { Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";

export const command = "list";
export const describe = "List supported hooks and their status";

export const builder = (yargs: Argv) => yargs;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listHooks: typeof defaultListHooks;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listHooks: defaultListHooks,
  log: console.log,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    deps.readConfig(root);

    const hooks = deps.listHooks(root);

    deps.log("Hook            Blocking   Installed");
    for (const hook of hooks) {
      const name = hook.name.padEnd(16);
      const blocking = (hook.blocking ? "yes" : "no").padEnd(11);
      const installed = hook.exists ? "yes" : "no";
      deps.log(`${name}${blocking}${installed}`);
    }
  };

export const handler = createHandler();
