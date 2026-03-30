import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "list";
export const describe = "List active worktrees linked to a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" })
    .option("json", { type: "boolean", describe: "Output as JSON" });

type ListWorktreesArgs = {
  id: string;
  "project-id"?: string;
  json?: boolean;
};

type Deps = {
  cwd: () => string;
  resolveProjectId: typeof defaultResolveProjectId;
  resolveTicketByShorthand: typeof defaultResolveTicketByShorthand;
  listWorkspaces: typeof defaultListWorkspaces;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  cwd: () => process.cwd(),
  resolveProjectId: defaultResolveProjectId,
  resolveTicketByShorthand: defaultResolveTicketByShorthand,
  listWorkspaces: defaultListWorkspaces,
  log: console.log,
};

type TableRow = {
  workspace: string;
  branch: string;
  path: string;
};

const formatTable = (rows: TableRow[]) => {
  const header: TableRow = { workspace: "Workspace", branch: "Branch", path: "Path" };

  const widths = {
    workspace: Math.max(header.workspace.length, ...rows.map((row) => row.workspace.length)),
    branch: Math.max(header.branch.length, ...rows.map((row) => row.branch.length)),
    path: Math.max(header.path.length, ...rows.map((row) => row.path.length)),
  };

  const pad = (value: string, width: number) => value.padEnd(width);
  const line = (row: TableRow) =>
    `${pad(row.workspace, widths.workspace)}   ${pad(row.branch, widths.branch)}   ${pad(row.path, widths.path)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<ListWorktreesArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const workspaces = await deps.listWorkspaces(API_URL, projectId);
    const ticketWorktrees = workspaces.filter(
      (workspace) => workspace.ticket_shorthand === ticket.shorthand && workspace.worktree_path,
    );

    if (ticketWorktrees.length === 0) {
      deps.log(`No worktrees found for ticket ${argv.id}`);
      return;
    }

    if (argv.json) {
      const jsonRows = ticketWorktrees.map((workspace) => ({
        workspace_shorthand: workspace.workspace_shorthand,
        workspace_id: workspace.id,
        branch: workspace.branch ?? null,
        worktree_path: workspace.worktree_path ?? null,
      }));
      deps.log(JSON.stringify(jsonRows, null, 2));
      return;
    }

    const rows = ticketWorktrees.map((workspace) => ({
      workspace: workspace.workspace_shorthand,
      branch: workspace.branch ?? "-",
      path: workspace.worktree_path ?? "-",
    }));

    deps.log(formatTable(rows));
  };

export const handler = createHandler();
