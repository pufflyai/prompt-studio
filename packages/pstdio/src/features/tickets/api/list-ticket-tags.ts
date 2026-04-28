import { listPlannerTags } from "@/features/planner/api/planner-tickets";

export const listTicketTags = async (projectId: string) => listPlannerTags(projectId);
