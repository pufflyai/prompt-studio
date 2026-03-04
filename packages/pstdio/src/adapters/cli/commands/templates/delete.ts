import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteTemplate } from "@/features/templates/api/delete-template";

export const command = "delete";
export const describe = "Delete a template";

export const builder = (yargs: Argv) =>
  yargs.option("name", {
    type: "string",
    demandOption: true,
    describe: "Name of the template to delete",
  });

type DeleteArgs = { name: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  deleteTemplate: typeof deleteTemplate;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  deleteTemplate,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    await deps.deleteTemplate(API_URL, config.project_id, argv.name);
    console.log(`Deleted template "${argv.name}"`);
  };

export const handler = createHandler();
