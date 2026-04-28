import { listPlannerStatuses } from "@/features/planner/api/planner-tickets";

export const listTicketStatuses = async (projectId: string) => listPlannerStatuses(projectId);
