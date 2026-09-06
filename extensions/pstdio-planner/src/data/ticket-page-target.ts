import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import type { TicketResourceReference } from "./ticket-resource-hierarchy";

const plannerPage = (id: string) => ({ kind: "page" as const, id, extensionId: "pstdio.pstdio-planner" });

// Planner owns this resource hierarchy and chooses its pages. The host must not
// infer a destination from whichever page happens to accept a resource kind.
export const ticketPageTarget = (resource: ResourceRef): NavigationTargetPage => {
  const parent = resource.metadata?.resourceParent;
  const ticketParent = parent && typeof parent === "object" && "type" in parent && parent.type === "ticket";
  return {
    kind: "page",
    page: plannerPage("ticket"),
    resource,
    parent: ticketParent
      ? ticketPageTarget(parent as TicketResourceReference)
      : { kind: "page", page: plannerPage("tickets") },
  };
};
