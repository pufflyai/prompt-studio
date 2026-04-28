export type { TicketFile } from "@pstdio/sdk/resources";

import { listPlannerTicketFiles } from "@/features/planner/api/planner-tickets";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const listTicketFiles = async (ticketId: string, projectId = resolveProjectId(process.cwd()).projectId) =>
  listPlannerTicketFiles(projectId, ticketId);
