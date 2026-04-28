import { getPlannerTicket } from "@/features/planner/api/planner-tickets";
import { resolveProjectId } from "@/features/projects/resolve-project-id";

export const getTicket = async (id: string, projectId?: string) => {
  const resolvedProjectId = projectId ?? resolveProjectId(process.cwd()).projectId;
  return getPlannerTicket(resolvedProjectId, id);
};
