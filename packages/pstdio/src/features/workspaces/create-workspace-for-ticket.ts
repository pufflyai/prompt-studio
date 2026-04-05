import { createTicketAttempt as defaultCreateTicketAttempt } from "@/features/tickets/api/create-ticket-attempt";
import { listTickets as defaultListTickets } from "@/features/tickets/api/list-tickets";

type CreateWorkspaceForTicketInput = {
  projectId: string;
  repoRoot: string;
  ticketShorthand: string;
  base?: string;
};

type Deps = {
  listTickets: typeof defaultListTickets;
  createTicketAttempt: typeof defaultCreateTicketAttempt;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  listTickets: defaultListTickets,
  createTicketAttempt: defaultCreateTicketAttempt,
  log: console.log,
};

export const createWorkspaceForTicket = async (input: CreateWorkspaceForTicketInput, deps: Deps = defaultDeps) => {
  const { projectId, repoRoot, ticketShorthand, base } = input;
  const baseRef = base ?? "HEAD";

  const tickets = await deps.listTickets({ project_id: projectId, shorthand: ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${ticketShorthand}`);
  const ticket = tickets[0];

  const { workspace } = await deps.createTicketAttempt(ticket.id, {
    mode: "worktree",
    start_session: false,
    base: baseRef,
    repo_path: repoRoot,
  });

  const shorthand = workspace.workspace_shorthand;
  const wtPath = workspace.worktree_path;
  deps.log(`Created workspace ${shorthand} for ${ticketShorthand} at ${wtPath ?? "(unavailable)"}`);

  return workspace;
};
