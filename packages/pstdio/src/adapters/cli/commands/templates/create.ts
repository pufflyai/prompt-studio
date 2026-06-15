import { readFileSync } from "node:fs";
import type { Arguments, Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { createTemplate } from "@/features/templates/api/create-template";

export const command = "create";
export const describe = "Create a new template";

export const builder = (yargs: Argv) =>
  yargs
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "Unique template name",
    })
    .option("type", {
      type: "string",
      demandOption: true,
      describe: "Template type (any string contributed by an extension or the default catalog)",
    })
    .option("file", {
      type: "string",
      demandOption: true,
      describe: "Path to template markdown file, or - for stdin",
    })
    .option("default", {
      type: "boolean",
      describe: "Set as default template for its type",
    });

type CreateArgs = {
  name: string;
  type: string;
  file: string;
  default?: boolean;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  createTemplate: typeof createTemplate;
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
  createTemplate,
  readInput,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<CreateArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const content = deps.readInput(argv.file);

    await deps.createTemplate(config.project_id, {
      name: argv.name,
      template_type: argv.type,
      content,
      is_default: argv.default,
    });

    console.log(`Created template "${argv.name}" (${argv.type})`);
  };

export const handler = createHandler();
