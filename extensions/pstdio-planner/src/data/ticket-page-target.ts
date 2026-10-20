import type { NavigationTargetPage, ResourceRef } from "@pstdio/sdk/extensions";
import { ticketDocumentDeclaration } from "./document-selection";

const plannerPage = (id: string) => ({ kind: "page" as const, id, extensionId: "pstdio.pstdio-planner" });
export const ticketDocumentPage = {
  id: "ticket",
  ref: plannerPage("ticket"),
  path: "ticket",
  document: ticketDocumentDeclaration,
};
export const ticketRequestsPage = { id: "ticket-requests", ref: plannerPage("ticket-requests") };
// Selecting this document in the ticket navigation opens the review requests page.
export const REVIEW_REQUESTS_DOCUMENT = "review-requests";
export const ticketsPageTarget = { kind: "page", page: plannerPage("tickets") } satisfies NavigationTargetPage;

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
          ...(typeof parent.shorthand === "string" ? { shorthand: parent.shorthand } : {}),
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
    parent: ticketParent ? ticketPageTarget(ticketParent) : ticketsPageTarget,
  };
};

// The requests page keeps the ticket as its parent, so the ticket navigation stays beside the forms.
export const ticketRequestsTarget = (resource: ResourceRef): NavigationTargetPage => ({
  kind: "page",
  page: ticketRequestsPage.ref,
  resource: { ...resource, metadata: { ...resource.metadata, documentId: REVIEW_REQUESTS_DOCUMENT } },
  parent: ticketPageTarget(resource),
});

export const ticketFileTarget = (resource: ResourceRef, file: { id: string; name: string }, icon = "FileText") => ({
  kind: "page" as const,
  page: ticketDocumentPage.ref,
  resource: { ...resource, label: file.name, icon, metadata: { ...resource.metadata, documentId: file.id } },
  parent: ticketPageTarget(resource),
});
