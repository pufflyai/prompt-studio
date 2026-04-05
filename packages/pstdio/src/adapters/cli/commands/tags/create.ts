import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createTag } from "@/features/tags/api/create-tag";

const VALID_TYPES = ["single_select", "multi_select"] as const;

export const command = "create";
export const describe = "Create a new tag definition";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Tag name",
    })
    .option("type", {
      type: "string",
      default: "single_select",
      describe: `Tag type (${VALID_TYPES.join(", ")})`,
    });

type CreateArgs = {
  name: string;
  type: string;
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
    const validTypes: readonly string[] = VALID_TYPES;
    if (!validTypes.includes(argv.type)) {
      throw new Error(`Invalid type: ${argv.type}. Must be one of: ${VALID_TYPES.join(", ")}`);
    }

    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.createTag(config.project_id, {
      name: argv.name,
      type: argv.type as "single_select" | "multi_select",
    });

    console.log(`Created tag "${argv.name}"`);
  };

export const handler = createHandler();
