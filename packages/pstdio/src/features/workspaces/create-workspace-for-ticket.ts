import { listPlannerTickets as defaultListPlannerTickets } from "@/features/planner/api/planner-tickets";
import { createWorkspace as defaultCreateWorkspace } from "./api/create-workspace";

type CreateWorkspaceForTicketInput = {
  projectId: string;
  repoRoot: string;
  ticketShorthand: string;
  base?: string;
};

type Deps = {
  listPlannerTickets: typeof defaultListPlannerTickets;
  createWorkspace: typeof defaultCreateWorkspace;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  listPlannerTickets: defaultListPlannerTickets,
  createWorkspace: defaultCreateWorkspace,
  log: console.log,
};

export const createWorkspaceForTicket = async (input: CreateWorkspaceForTicketInput, deps: Deps = defaultDeps) => {
  const { projectId, repoRoot, ticketShorthand, base } = input;
  const baseRef = base ?? "HEAD";

  const tickets = await deps.listPlannerTickets({ project_id: projectId, shorthand: ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${ticketShorthand}`);
  const ticket = tickets[0];

  const workspace = await deps.createWorkspace({
    project_id: projectId,
    name: ticket.shorthand,
    branch: `workspace/${ticket.shorthand}`,
    anchors: [
      {
        type: "pstdio.planner.ticket",
        id: ticket.id,
        projectId,
        label: ticket.shorthand,
        extensionId: "pstdio.planner",
        role: "primary",
        metadata: { base: baseRef, repoRoot },
      },
    ],
  });

  const shorthand = workspace.workspace_shorthand;
  const wtPath = workspace.worktree_path;
  deps.log(`Created workspace ${shorthand} for ${ticketShorthand} at ${wtPath ?? "(unavailable)"}`);

  return workspace;
};
