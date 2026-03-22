import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTags } from "@/features/tags/api/list-tags";

export const command = "list";
export const describe = "List all tags";

export const builder = (yargs: Argv) => yargs;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTags: typeof listTags;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTags,
};

const formatTable = (tags: Awaited<ReturnType<typeof listTags>>) => {
  const lines: string[] = [];
  for (const tag of tags) {
    lines.push(`${tag.name} (${tag.type})`);
    for (const opt of tag.options) {
      lines.push(`  ${opt.name}  ${opt.color}`);
    }
  }
  return lines.join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const tags = await deps.listTags(API_URL, config.project_id);

    if (tags.length === 0) {
      console.log("No tags found.");
      return;
    }

    console.log(formatTable(tags));
  };

export const handler = createHandler();
