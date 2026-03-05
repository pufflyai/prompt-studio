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
  const header = { name: "Name", color: "Color" };
  const rows = tags.map((t) => ({
    name: t.name,
    color: t.color,
  }));

  const widths = {
    name: Math.max(header.name.length, ...rows.map((r) => r.name.length)),
    color: Math.max(header.color.length, ...rows.map((r) => r.color.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: { name: string; color: string }) => `${pad(r.name, widths.name)}   ${r.color}`;

  return [line(header), ...rows.map(line)].join("\n");
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
