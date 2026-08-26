import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createStandaloneWorkspace } from "@/features/workspaces/create-standalone-workspace";

export const command = "create";
export const describe = "Create a provider-backed workspace";

export const builder = (yargs: Argv) =>
  yargs
    .option("base", { type: "string", describe: "Base branch/ref. Defaults to HEAD" })
    .option("provider", { type: "string", describe: "Workspace provider ID. Defaults to pstdio.worktree" })
    .option("params", { type: "string", describe: "Provider parameters as a JSON object" });

type CreateArgs = {
  base?: string;
  provider?: string;
  params?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createStandaloneWorkspace: typeof createStandaloneWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createStandaloneWorkspace,
};

const parseParams = (raw?: string) => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid --params JSON: ${raw}`);
  }
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.createStandaloneWorkspace({
      projectId: config.project_id,
      base: argv.base,
      providerId: argv.provider,
      params: parseParams(argv.params),
    });
  };

export const handler = createHandler();
