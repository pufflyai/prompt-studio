import { listPlannerTickets } from "@/features/planner/api/planner-tickets";

type ListTicketsParams = {
  project_id: string;
  status?: string;
  tag?: string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
};

export const listTickets = async (params: ListTicketsParams) => listPlannerTickets(params);
