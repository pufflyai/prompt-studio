import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createTag } from "@/features/tags/api/create-tag";

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
export const describe = "Create a new tag";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Tag name",
    })
    .option("color", {
      type: "string",
      demandOption: true,
      describe: `Tag color (${VALID_COLORS.join(", ")})`,
    });

type CreateArgs = {
  name: string;
  color: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createTag: typeof createTag;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  createTag,
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

    await deps.createTag(API_URL, config.project_id, {
      name: argv.name,
      color: argv.color,
    });

    console.log(`Created tag "${argv.name}"`);
  };

export const handler = createHandler();
