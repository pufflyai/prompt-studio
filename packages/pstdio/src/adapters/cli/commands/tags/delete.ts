import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { deleteTag } from "@/features/tags/api/delete-tag";
import { listTags } from "@/features/tags/api/list-tags";

export const command = "delete";
export const describe = "Delete a tag";

export const builder = (yargs: Argv) =>
  yargs.option("name", {
    type: "string",
    demandOption: true,
    describe: "Name of the tag to delete",
  });

type DeleteArgs = { name: string };

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTags: typeof listTags;
  deleteTag: typeof deleteTag;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTags,
  deleteTag,
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<DeleteArgs>) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const tags = await deps.listTags(API_URL, config.project_id);
    const tag = tags.find((t) => t.name === argv.name);
    if (!tag) throw new Error(`Tag not found: ${argv.name}`);

    await deps.deleteTag(API_URL, config.project_id, tag.id);
    console.log(`Deleted tag "${argv.name}"`);
  };

export const handler = createHandler();
