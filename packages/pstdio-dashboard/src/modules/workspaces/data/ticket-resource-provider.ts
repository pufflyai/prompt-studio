import type { ResourceProvider, ResourceRef } from "@pstdio/workbench/core";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

interface TicketAncestryItem {
  id: string;
  label: string;
  shorthand?: string;
}

interface CreateTicketResourceProviderInput {
  getProjectId: () => string | undefined;
  getWorkspaces: () => readonly ResourceRef[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => textValue(metadata?.[key]);

const ticketAncestryFromMetadata = (metadata: Record<string, unknown> | undefined) => {
  const breadcrumb = metadata?.ticketBreadcrumb;
  if (Array.isArray(breadcrumb)) {
    const items = breadcrumb.flatMap((item): TicketAncestryItem[] => {
      if (!isRecord(item)) return [];
      const id = textValue(item.id);
      if (!id) return [];
      const shorthand = textValue(item.shorthand);
      return [{ id, label: textValue(item.label) ?? shorthand ?? id, ...(shorthand ? { shorthand } : {}) }];
    });
    if (items.length > 0) return items;
  }

  const id = metadataString(metadata, "ticketId") ?? metadataString(metadata, "ticketShorthand");
  if (!id) return [];
  const shorthand = metadataString(metadata, "ticketShorthand");
  return [
    {
      id,
      label: metadataString(metadata, "ticketLabel") ?? shorthand ?? "Ticket",
      ...(shorthand ? { shorthand } : {}),
    },
  ];
};

const ticketBoardResource = (projectId: string) => {
  const renderer = getCachedDashboardExtensionMetadata(projectId)?.dataRenderers?.find(
    (candidate) => candidate.resourceKind === "ticket",
  );

  return createDashboardResource(
    "dashboard-view",
    renderer?.id ?? "tickets",
    "Tickets",
    "square-kanban",
    projectId,
    renderer ? { dataRendererId: renderer.id } : undefined,
  );
};

const ticketResource = (projectId: string, item: TicketAncestryItem, parent: string): ResourceRef => ({
  ...createDashboardResource("ticket", item.id, item.label, "component", projectId, {
    projectId,
    ticketId: item.id,
    ...(item.shorthand ? { ticketShorthand: item.shorthand } : {}),
  }),
  parent,
});

export const ticketParentUriFromMetadata = (metadata: Record<string, unknown> | undefined, projectId: string) => {
  const leaf = ticketAncestryFromMetadata(metadata).at(-1);
  return leaf ? createDashboardResource("ticket", leaf.id, leaf.label, "component", projectId).uri : undefined;
};

export const createTicketResourceProvider = (input: CreateTicketResourceProviderInput) => {
  const synced = new Map<string, ResourceRef>();
  const connected = new Map<string, ResourceRef>();

  const projectWorkspace = (workspace: ResourceRef, target: Map<string, ResourceRef>) => {
    const projectId = metadataString(workspace.metadata, "projectId") ?? input.getProjectId();
    if (!projectId) return workspace;

    const board = ticketBoardResource(projectId);
    let parent = board.uri;
    for (const item of ticketAncestryFromMetadata(workspace.metadata)) {
      const ticket = ticketResource(projectId, item, parent);
      target.set(ticket.uri, ticket);
      parent = ticket.uri;
    }

    return { ...workspace, parent: parent === board.uri ? dashboardResources.workspaces.uri : parent };
  };
  const connectWorkspace = (workspace: ResourceRef) => projectWorkspace(workspace, connected);

  const refresh = () => {
    synced.clear();
    for (const workspace of input.getWorkspaces()) projectWorkspace(workspace, synced);
  };

  const provider: ResourceProvider = {
    id: "dashboard-workbench.tickets",
    kind: "ticket",
    get: (uri) => {
      refresh();
      const projectId = input.getProjectId();
      const board = projectId ? ticketBoardResource(projectId) : undefined;
      if (dashboardResources.workspaces.uri === uri) return dashboardResources.workspaces;
      return board?.uri === uri ? board : (connected.get(uri) ?? synced.get(uri));
    },
    list: (query) => {
      refresh();
      const normalizedQuery = query.trim().toLowerCase();
      return [...new Map([...synced, ...connected]).values()]
        .filter((resource) => !normalizedQuery || resource.label?.toLowerCase().includes(normalizedQuery))
        .map((resource) => ({ resource, group: "Tickets" }));
    },
  };

  return { provider, connectWorkspace };
};
