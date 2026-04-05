import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createStatus } from "@/features/statuses/api/create-status";

const VALID_COLORS = [
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
] as const;

export const command = "create";
export const describe = "Create a new ticket status";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Status name",
    })
    .option("color", {
      type: "string",
      demandOption: true,
      describe: `Status color (${VALID_COLORS.join(", ")})`,
    })
    .option("default", {
      type: "boolean",
      describe: "Set as the default status",
    });

type CreateArgs = {
  name: string;
  color: string;
  default?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createStatus: typeof createStatus;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createStatus,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const validColors: readonly string[] = VALID_COLORS;
    if (!validColors.includes(argv.color)) {
      throw new Error(`Invalid color: ${argv.color}. Must be one of: ${VALID_COLORS.join(", ")}`);
    }

    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.createStatus(config.project_id, {
      name: argv.name,
      color: argv.color,
      is_default: argv.default,
    });

    console.log(`Created status "${argv.name}"`);
  };

export const handler = createHandler();
