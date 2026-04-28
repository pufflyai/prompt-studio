import { createPlannerClient } from "@pstdio/pstdio-ext-planner/sdk";
import { PstdioApiError } from "@pstdio/sdk/client";
import { API_URL } from "@/features/api-url";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

const plannerClient = () =>
  createPlannerClient({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

export const deleteTicket = async (projectIdOrId: string, maybeId?: string) => {
  const projectId = maybeId ? projectIdOrId : resolveProjectId(process.cwd()).projectId;
  const id = maybeId ?? projectIdOrId;

  try {
    await plannerClient().deleteTicket(projectId, { ticket_id: id });
  } catch (error) {
    if (error instanceof PstdioApiError && error.message.includes(`Ticket not found: ${id}`)) return null;
    throw error;
  }
};
