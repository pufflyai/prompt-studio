import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";

const plannerPage = (id: string) => ({ kind: "page" as const, id, extensionId: "pstdio.pstdio-planner" });

// Planner owns this resource hierarchy and chooses its pages. The host must not
// infer a destination from whichever page happens to accept a resource kind.
export const ticketPageTarget = (resource: ResourceRef): NavigationTargetPage => {
  const parent = resource.metadata?.resourceParent;
  const metadata = parent && typeof parent === "object" && "metadata" in parent ? parent.metadata : undefined;
  const ticketParent =
    parent &&
    typeof parent === "object" &&
    "type" in parent &&
    parent.type === "ticket" &&
    "id" in parent &&
    typeof parent.id === "string"
      ? {
          type: parent.type,
          id: parent.id,
          ...(typeof parent.label === "string" ? { label: parent.label } : {}),
          ...(typeof parent.extensionId === "string" ? { extensionId: parent.extensionId } : {}),
          ...(typeof parent.projectId === "string" ? { projectId: parent.projectId } : {}),
          ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { metadata } : {}),
        }
      : undefined;
  return {
    kind: "page",
    page: plannerPage("ticket"),
    resource,
    parent: ticketParent ? ticketPageTarget(ticketParent) : { kind: "page", page: plannerPage("tickets") },
  };
};
