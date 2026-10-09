import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import { ticketPageTarget } from "../data/ticket-page-target";
import type { StoredStatus, StoredTicket } from "../data/types";

export { plannerTicketsChanged } from "../events";
export const plannerExtensionId = "pstdio.pstdio-planner";
export const doneStatusId = "done";
export const blockedStatusId = "blocked";
export const humanRequestedTagId = "default-human-requested-true";
export type PlannerTicket = Pick<
  StoredTicket,
  "id" | "shorthand" | "title" | "content" | "statusId" | "tagIds" | "parentId" | "dependsOn" | "blockedReason"
>;
export type PlannerStatus = StoredStatus;
export const ticketTarget = (ticket: Pick<PlannerTicket, "id" | "shorthand" | "title">): NavigationTargetPage =>
  ticketPageTarget({
    type: "ticket",
    id: ticket.id,
    shorthand: ticket.shorthand,
    label: `${ticket.shorthand} ${ticket.title}`,
    extensionId: plannerExtensionId,
  });
export const dependencyIds = (value: PlannerTicket["dependsOn"]) => {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return values.map((id) => id.trim()).filter((id) => id.length > 0 && id !== "[]");
};
