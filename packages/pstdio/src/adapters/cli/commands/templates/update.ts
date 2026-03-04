import { readFileSync } from "node:fs";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { updateTemplate } from "@/features/templates/api/update-template";

export const command = "update";
export const describe = "Update a template";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Name of the template to update",
    })
    .option("file", {
      type: "string",
      describe: "Path to new template content, or - for stdin",
    })
    .option("default", {
      type: "boolean",
      describe: "Set as default template for its type",
    });

type UpdateArgs = {
  name: string;
  file?: string;
  default?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  updateTemplate: typeof updateTemplate;
  readInput: (file: string) => string;
};

const readInput = (file: string) => {
  if (file === "-") {
    return readFileSync(0, "utf8");
  }
  return readFileSync(file, "utf8");
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  updateTemplate,
  readInput,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<UpdateArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const content = argv.file ? deps.readInput(argv.file) : undefined;

    await deps.updateTemplate(API_URL, config.project_id, argv.name, {
      content,
      is_default: argv.default,
    });

    console.log(`Updated template "${argv.name}"`);
  };

export const handler = createHandler();
