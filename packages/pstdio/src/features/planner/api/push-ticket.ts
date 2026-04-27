import { createPlannerClient, type PushPlannerTicketInput } from "@pstdio/pstdio-ext-planner/sdk";
import { API_URL } from "@/features/api-url";

const plannerClient = () =>
  createPlannerClient({
    baseUrl: process.env.PSTDIO_API_URL ?? API_URL,
    token: process.env.PSTDIO_API_TOKEN,
  });

export const pushPlannerTicket = async (projectId: string, input: PushPlannerTicketInput) =>
  plannerClient().pushTicket(projectId, input);
