import type { ResourceRef, WorkbenchModuleContributionContext } from "@pstdio/workbench/core";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

interface TicketBreadcrumbItem {
  id: string;
  label: string;
  shorthand?: string;
}

const metadataString = (resource: ResourceRef, key: string) => {
  const value = resource.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const normalizeTicketBreadcrumb = (value: unknown): TicketBreadcrumbItem[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = textValue(item.id);
    if (!id) return [];
    const shorthand = textValue(item.shorthand);
    const label = textValue(item.label) ?? shorthand ?? id;
    return [{ id, label, ...(shorthand ? { shorthand } : {}) }];
  });
};

const ticketBreadcrumbContext = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const projectId = metadataString(resource, "projectId") ?? getDashboardSelectedProjectId(ctx);
  if (!projectId) return null;

  const breadcrumb = normalizeTicketBreadcrumb(resource.metadata?.ticketBreadcrumb);
  if (breadcrumb.length > 0) return { projectId, breadcrumb };

  const ticketId = metadataString(resource, "ticketId");
  const ticketShorthand = metadataString(resource, "ticketShorthand");
  const ticketReference = ticketId ?? ticketShorthand;
  if (!ticketReference) return null;

  return {
    projectId,
    breadcrumb: [
      {
        id: ticketReference,
        label: metadataString(resource, "ticketLabel") ?? ticketShorthand ?? "Ticket",
        ...(ticketShorthand ? { shorthand: ticketShorthand } : {}),
      },
    ],
  };
};

const ticketBoardResource = (projectId: string) => {
  const ticketsRenderer = getCachedDashboardExtensionMetadata(projectId)?.dataRenderers?.find(
    (renderer) => renderer.resourceKind === "ticket",
  );

  return createDashboardResource(
    "dashboard-view",
    ticketsRenderer?.id ?? "tickets",
    "Tickets",
    "square-kanban",
    projectId,
    ticketsRenderer ? { dataRendererId: ticketsRenderer.id } : undefined,
  );
};

const ticketResource = (projectId: string, item: TicketBreadcrumbItem): ResourceRef => ({
  kind: "ticket",
  uri: `dashboard-workbench://ticket/${encodeURIComponent(item.id)}`,
  id: item.id,
  label: item.label,
  icon: "component",
  metadata: {
    projectId,
    ticketId: item.id,
    ...(item.shorthand ? { ticketShorthand: item.shorthand } : {}),
  },
});

const setTicketWorkspaceBreadcrumb = (
  ctx: WorkbenchModuleContributionContext,
  context: NonNullable<ReturnType<typeof ticketBreadcrumbContext>>,
  resource: ResourceRef,
) => {
  const ticketsResource = ticketBoardResource(context.projectId);
  const ticketResources = context.breadcrumb.map((item) => ticketResource(context.projectId, item));

  ctx.breadcrumbs.setItems([
    {
      title: ticketsResource.label ?? "Tickets",
      icon: ticketsResource.icon,
      resource: ticketsResource,
      onClick: () => void ctx.resources.openResource(ticketsResource, { replaceActive: true }),
    },
    ...ticketResources.map((ticket) => ({
      title: ticket.label ?? "Ticket",
      icon: ticket.icon,
      resource: ticket,
      onClick: () => void ctx.resources.openResource(ticket, { replaceActive: true }),
    })),
    { title: resource.label ?? "Workspace", icon: resource.icon ?? "GitBranch", resource },
  ]);
};

export const setWorkspaceBreadcrumb = (ctx: WorkbenchModuleContributionContext, resource: ResourceRef) => {
  const ticketContext = ticketBreadcrumbContext(ctx, resource);
  if (ticketContext) {
    setTicketWorkspaceBreadcrumb(ctx, ticketContext, resource);
    return;
  }

  ctx.breadcrumbs.setItems([
    {
      title: "Workspaces",
      icon: dashboardResources.workspaces.icon,
      resource: dashboardResources.workspaces,
      onClick: () => void ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: true }),
    },
    { title: resource.label ?? "Workspace", icon: resource.icon ?? "GitBranch", resource },
  ]);
};
