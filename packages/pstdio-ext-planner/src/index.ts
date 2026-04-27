import { defineExtension } from "@pstdio/sdk/extensions";
import { PLANNER_EXTENSION_ID } from "./contract";

export default defineExtension({
  id: PLANNER_EXTENSION_ID,
  name: "Planner",
  version: "0.1.0",
});

export type {
  PlannerTicketFileRecord,
  PlannerTicketProviderApi,
  PlannerTicketRecord,
  PlannerTicketUpdateInput,
  PlannerTicketUploadInput,
  PlannerTicketWorkflow,
  PlannerTicketWorkflowContext,
  TicketPullInput,
  TicketPullResult,
  TicketPushInput,
  TicketPushResult,
} from "./contract";
export { PLANNER_EXTENSION_ID, PLANNER_EXTENSION_PACKAGE_NAME } from "./contract";
export { localTicketWorkflow, pullLocalTickets, pushLocalTicket } from "./local-ticket-workflow";
