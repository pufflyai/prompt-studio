import { listPlannerTickets as defaultListPlannerTickets } from "@/features/planner/api/planner-tickets";
import { createWorkspace as defaultCreateWorkspace } from "@/features/workspaces/api/create-workspace";

type CreateWorkspaceForExistingWorktreeInput = {
  projectId: string;
  ticketShorthand: string;
  worktreePath: string;
  branch: string;
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

export const createWorkspaceForExistingWorktree = async (
  input: CreateWorkspaceForExistingWorktreeInput,
  deps: Deps = defaultDeps,
) => {
  const tickets = await deps.listPlannerTickets({ project_id: input.projectId, shorthand: input.ticketShorthand });
  if (tickets.length === 0) throw new Error(`Ticket not found: ${input.ticketShorthand}`);

  const ticket = tickets[0];
  const workspace = await deps.createWorkspace({
    project_id: input.projectId,
    name: ticket.shorthand,
    anchors: [
      {
        type: "pstdio.planner.ticket",
        id: ticket.id,
        projectId: input.projectId,
        label: ticket.shorthand,
        extensionId: "pstdio.planner",
        role: "primary",
      },
    ],
    branch: input.branch,
    worktree_path: input.worktreePath,
  });

  deps.log(
    `Created workspace ${workspace.workspace_shorthand} for ${ticket.shorthand} linked to ${workspace.worktree_path}`,
  );

  return workspace;
};
