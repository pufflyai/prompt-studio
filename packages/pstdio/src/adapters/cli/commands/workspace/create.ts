import type { Arguments, Argv } from "yargs";
import { findProjectRoot, readConfig } from "@/features/config/config";
import { createStandaloneWorkspace } from "@/features/workspaces/create-standalone-workspace";

export const command = "create";
export const describe = "Create a provider-backed workspace";

export const builder = (yargs: Argv) =>
  yargs
    .option("provider", { type: "string", demandOption: true, describe: "Workspace provider ID" })
    .option("params", { type: "string", describe: "Provider parameters as a JSON object" });

type CreateArgs = {
  provider: string;
  params?: string;
};

type Deps = {
  cwd: () => string;
  findProjectRoot: typeof findProjectRoot;
  readConfig: typeof readConfig;
  createStandaloneWorkspace: typeof createStandaloneWorkspace;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findProjectRoot,
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
    const root = deps.findProjectRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.createStandaloneWorkspace({
      projectId: config.project_id,
      providerId: argv.provider,
      params: parseParams(argv.params),
    });
  };

export const handler = createHandler();
