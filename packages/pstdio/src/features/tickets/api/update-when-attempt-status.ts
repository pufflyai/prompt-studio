import { resolveProjectId } from "@/features/projects/resolve-project-id";
import { listWorkspaces } from "@/features/workspaces/api/list-workspaces";
import { listTicketStatuses } from "./list-ticket-statuses";
import { updateTicket } from "./update-ticket";

export const updateWhenAttemptStatus = async (
  projectIdOrTicketId: string,
  ticketIdOrInput:
    | string
    | {
        all_attempts_status: string;
        set_status: string;
      },
  maybeInput?: {
    all_attempts_status: string;
    set_status: string;
  },
) => {
  const hasProjectId = typeof ticketIdOrInput === "string";
  const projectId = hasProjectId ? projectIdOrTicketId : resolveProjectId(process.cwd()).projectId;
  const ticketId = hasProjectId ? ticketIdOrInput : projectIdOrTicketId;
  const input = hasProjectId ? maybeInput! : ticketIdOrInput;

  const ticketWorkspaces = (await listWorkspaces(projectId)).filter(
    (workspace) => workspace.ticket_shorthand === ticketId,
  );

  if (
    ticketWorkspaces.length === 0 ||
    !ticketWorkspaces.every((workspace) => workspace.attempt_status_name === input.all_attempts_status)
  ) {
    return { updated: false };
  }

  const status = (await listTicketStatuses(projectId)).find((candidate) => candidate.name === input.set_status);
  if (!status) throw new Error(`Status not found: ${input.set_status}`);

  await updateTicket(projectId, ticketId, { status_id: status.id });
  return { updated: true };
};
