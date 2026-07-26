import type { Argv } from "yargs";
import { findGitRoot, readConfig } from "@/features/config/config";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "list";
export const describe = "List active workspaces";

export const builder = (yargs: Argv) =>
  yargs.option("json", {
    type: "boolean",
    default: false,
    describe: "Print complete workspace records as JSON",
  });

type Deps = {
  cwd: () => string;
  findGitRoot: typeof findGitRoot;
  readConfig: typeof readConfig;
  listWorkspaces: typeof defaultListWorkspaces;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  findGitRoot,
  readConfig,
  listWorkspaces: defaultListWorkspaces,
  log: console.log,
};

const formatTable = (workspaces: Awaited<ReturnType<typeof defaultListWorkspaces>>) => {
  const header = { workspace: "Workspace", id: "ID", branch: "Branch", path: "Path" };
  const rows = workspaces.map((workspace) => ({
    workspace: workspace.workspace_shorthand,
    id: workspace.id,
    branch: workspace.branch ?? "null",
    path: workspace.worktree_path ?? "null",
  }));
  const widths = {
    workspace: Math.max(header.workspace.length, ...rows.map((row) => row.workspace.length)),
    id: Math.max(header.id.length, ...rows.map((row) => row.id.length)),
    branch: Math.max(header.branch.length, ...rows.map((row) => row.branch.length)),
  };
  const line = (row: typeof header) =>
    `${row.workspace.padEnd(widths.workspace)}   ${row.id.padEnd(widths.id)}   ${row.branch.padEnd(widths.branch)}   ${row.path}`;

  return [line(header), ...rows.map(line)];
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: { json?: boolean } = {}) => {
    const root = deps.findGitRoot(deps.cwd());
    if (!root) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const config = deps.readConfig(root);
    if (!config) throw new Error("Not inside a pstdio project. Run 'pstdio projects create' first.");

    const workspaces = await deps.listWorkspaces(config.project_id);

    if (argv.json) {
      deps.log(JSON.stringify(workspaces, null, 2));
      return;
    }

    if (workspaces.length === 0) {
      deps.log("No active workspaces.");
      return;
    }

    for (const line of formatTable(workspaces)) deps.log(line);
  };

export const handler = createHandler();
