import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listStatuses } from "@/features/statuses/api/list-statuses";

export const command = "list";
export const describe = "List all ticket statuses";

export const builder = (yargs: Argv) => yargs;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listStatuses: typeof listStatuses;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listStatuses,
};

const formatTable = (statuses: Awaited<ReturnType<typeof listStatuses>>) => {
  const header = { name: "Name", color: "Color", def: "Default" };
  const rows = statuses.map((s) => ({
    name: s.name,
    color: s.color,
    def: s.is_default ? "*" : "",
  }));

  const widths = {
    name: Math.max(header.name.length, ...rows.map((r) => r.name.length)),
    color: Math.max(header.color.length, ...rows.map((r) => r.color.length)),
    def: Math.max(header.def.length, ...rows.map((r) => r.def.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: { name: string; color: string; def: string }) =>
    `${pad(r.name, widths.name)}   ${pad(r.color, widths.color)}   ${r.def}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const statuses = await deps.listStatuses(API_URL, config.project_id);

    if (statuses.length === 0) {
      console.log("No statuses found.");
      return;
    }

    console.log(formatTable(statuses));
  };

export const handler = createHandler();
