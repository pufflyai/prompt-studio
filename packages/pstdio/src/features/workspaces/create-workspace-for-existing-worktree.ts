import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";
import { listTickets as defaultListTickets } from "../tickets/api/list-tickets";

type CreateWorkspaceForExistingWorktreeInput = {
  projectId: string;
  ticketShorthand: string;
  worktreePath: string;
  branch: string;
};

type Deps = {
  listTickets: typeof defaultListTickets;
  createWorkspace: typeof defaultCreateWorkspace;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  listTickets: defaultListTickets,
  createWorkspace: defaultCreateWorkspace,
  log: console.log,
};

export const createWorkspaceForExistingWorktree = async (
  input: CreateWorkspaceForExistingWorktreeInput,
  deps: Deps = defaultDeps,
) => {
  const tickets = await deps.listTickets({ project_id: input.projectId, shorthand: input.ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${input.ticketShorthand}`);

  const ticket = tickets[0];
  const workspace = await deps.createWorkspace({
    project_id: input.projectId,
    ticket_id: ticket.id,
    ticket_shorthand: ticket.shorthand,
    branch: input.branch,
    worktree_path: input.worktreePath,
  });

  deps.log(
    `Created workspace ${workspace.workspace_shorthand} for ${ticket.shorthand} linked to ${workspace.worktree_path}`,
  );

  return workspace;
};
