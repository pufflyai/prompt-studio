import fs from "node:fs";
import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listRepos } from "@/features/projects/api/list-repos";

export const command = "repos";
export const describe = "List repos linked to a project";

export const builder = (yargs: Argv) => yargs.option("project-id", { type: "string", describe: "Project ID" });

type ReposArgs = {
  "project-id"?: string;
};

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listRepos: typeof listRepos;
  existsSync: typeof fs.existsSync;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listRepos,
  existsSync: fs.existsSync,
};

type RepoRow = { name: string; path: string; local: string };

const formatTable = (rows: RepoRow[]) => {
  const header: RepoRow = { name: "Name", path: "Path", local: "Local" };

  const widths = {
    name: Math.max(header.name.length, ...rows.map((r) => r.name.length)),
    path: Math.max(header.path.length, ...rows.map((r) => r.path.length)),
    local: Math.max(header.local.length, ...rows.map((r) => r.local.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: RepoRow) => `${pad(r.name, widths.name)}   ${pad(r.path, widths.path)}   ${r.local}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ReposArgs>) => {
    let projectId = argv["project-id"];

    if (!projectId) {
      const root = deps.findGitRoot(deps.cwd());
      if (!root) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      const config = deps.readConfig(root);
      if (!config) throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      projectId = config.project_id;
    }

    const repos = await deps.listRepos(API_URL, projectId);

    if (repos.length === 0) {
      console.log(
        "No repos found for this project. Use `pstdio projects create --repo <path>` or `pstdio projects link` to connect repos.",
      );
      return;
    }

    const rows = repos.map((repo) => ({
      name: repo.display_name ?? repo.name,
      path: repo.path,
      local: deps.existsSync(repo.path) ? "yes" : "no",
    }));

    console.log(formatTable(rows));
  };

export const handler = createHandler();
