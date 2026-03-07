import type { Arguments, Argv } from "yargs";
import { API_URL } from "@/features/api-url";
import { resolveProjectId as defaultResolveProjectId } from "@/features/projects/resolve-project-id";
import { resolveTicketByShorthand as defaultResolveTicketByShorthand } from "@/features/tickets/resolve-ticket-by-shorthand";
import { listWorkspaces as defaultListWorkspaces } from "@/features/workspaces/api/list-workspaces";

export const command = "workspaces";
export const describe = "List active workspaces linked to a ticket";

export const builder = (yargs: Argv) =>
  yargs
    .option("id", { type: "string", demandOption: true, describe: "Ticket shorthand (e.g. PS-12)" })
    .option("project-id", { type: "string", describe: "Project ID" });

type WorkspacesArgs = {
  id: string;
  "project-id"?: string;
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

type WorkspaceRow = {
  workspace: string;
  status: string;
  branch: string;
  path: string;
};

const formatTable = (rows: WorkspaceRow[]) => {
  const header: WorkspaceRow = {
    workspace: "Workspace",
    status: "Status",
    branch: "Branch",
    path: "Path",
  };

  const widths = {
    workspace: Math.max(header.workspace.length, ...rows.map((row) => row.workspace.length)),
    status: Math.max(header.status.length, ...rows.map((row) => row.status.length)),
    branch: Math.max(header.branch.length, ...rows.map((row) => row.branch.length)),
    path: Math.max(header.path.length, ...rows.map((row) => row.path.length)),
  };

  const pad = (value: string, width: number) => value.padEnd(width);
  const line = (row: WorkspaceRow) =>
    `${pad(row.workspace, widths.workspace)}   ${pad(row.status, widths.status)}   ${pad(row.branch, widths.branch)}   ${pad(row.path, widths.path)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async (argv: Arguments<WorkspacesArgs>) => {
    const { projectId } = deps.resolveProjectId(deps.cwd(), argv["project-id"]);

    const ticket = await deps.resolveTicketByShorthand(API_URL, projectId, argv.id);
    if (!ticket) throw new Error(`Ticket not found: ${argv.id}`);

    const workspaces = await deps.listWorkspaces(API_URL, projectId);
    const ticketWorkspaces = workspaces.filter((workspace) => workspace.ticket_shorthand === ticket.shorthand);

    if (ticketWorkspaces.length === 0) {
      deps.log("No ticket workspaces found.");
      return;
    }

    const rows = ticketWorkspaces.map((workspace) => ({
      workspace: workspace.workspace_shorthand,
      status: workspace.status,
      branch: workspace.branch ?? "-",
      path: workspace.worktree_path ?? "-",
    }));

    deps.log(formatTable(rows));
  };

export const handler = createHandler();
