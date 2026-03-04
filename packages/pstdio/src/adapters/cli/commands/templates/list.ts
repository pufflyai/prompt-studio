import type { Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listTemplates } from "@/features/templates/api/list-templates";

export const command = "list";
export const describe = "List all templates";

export const builder = (yargs: Argv) => yargs;

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listTemplates: typeof listTemplates;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listTemplates,
};

const formatTable = (templates: Awaited<ReturnType<typeof listTemplates>>) => {
  const header = { name: "Name", type: "Type", def: "Default" };
  const rows = templates.map((t) => ({
    name: t.name,
    type: t.template_type,
    def: t.is_default ? "*" : "",
  }));

  const widths = {
    name: Math.max(header.name.length, ...rows.map((r) => r.name.length)),
    type: Math.max(header.type.length, ...rows.map((r) => r.type.length)),
    def: Math.max(header.def.length, ...rows.map((r) => r.def.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: { name: string; type: string; def: string }) =>
    `${pad(r.name, widths.name)}   ${pad(r.type, widths.type)}   ${r.def}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a git repository.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const templates = await deps.listTemplates(API_URL, config.project_id);

    if (templates.length === 0) {
      console.log("No templates found.");
      return;
    }

    console.log(formatTable(templates));
  };

export const handler = createHandler();
