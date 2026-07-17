import type { ResourceProvider, ResourceRef } from "@pstdio/workbench/core";
import type { SyncedRow } from "@/lib/sync/collections";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

interface CreateTicketResourceProviderInput {
  getProjectId: () => string | undefined;
  getTickets: () => readonly SyncedRow[];
  getWorkspaces: () => readonly ResourceRef[];
}

const textValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => textValue(metadata?.[key]);

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

const ticketLabel = (row: SyncedRow) => {
  const shorthand = textValue(row.shorthand) ?? row.id;
  const title = textValue(row.title);
  return !title || title === shorthand ? shorthand : `${shorthand} ${title}`;
};

const ticketResource = (projectId: string, row: SyncedRow, board: ResourceRef): ResourceRef => {
  const shorthand = textValue(row.shorthand);
  const parentId = textValue(row.parent_id);
  return {
    ...createDashboardResource("ticket", row.id, ticketLabel(row), "component", projectId, {
      projectId,
      ticketId: row.id,
      ...(shorthand ? { ticketShorthand: shorthand } : {}),
    }),
    parent: parentId ? createDashboardResource("ticket", parentId, "", "component", projectId).uri : board.uri,
  };
};

export const ticketParentUriFromMetadata = (metadata: Record<string, unknown> | undefined, projectId: string) => {
  const ticketId = metadataString(metadata, "ticketId") ?? metadataString(metadata, "ticketShorthand");
  return ticketId ? createDashboardResource("ticket", ticketId, "", "component", projectId).uri : undefined;
};

export const createTicketResourceProvider = (input: CreateTicketResourceProviderInput) => {
  const synced = new Map<string, ResourceRef>();

  const refresh = () => {
    synced.clear();
    const projectId = input.getProjectId();
    if (!projectId) return;
    const board = ticketBoardResource(projectId);
    for (const row of input.getTickets()) {
      if (row.project_id !== projectId) continue;
      const resource = ticketResource(projectId, row, board);
      synced.set(resource.uri, resource);
    }
  };

  const connectWorkspace = (workspace: ResourceRef) => {
    const projectId = metadataString(workspace.metadata, "projectId") ?? input.getProjectId();
    if (!projectId) return workspace;
    const parent = ticketParentUriFromMetadata(workspace.metadata, projectId);
    return { ...workspace, parent: parent ?? dashboardResources.workspaces.uri };
  };

  const provider: ResourceProvider = {
    id: "dashboard-workbench.tickets",
    kind: "ticket",
    get: (uri) => {
      refresh();
      const projectId = input.getProjectId();
      const board = projectId ? ticketBoardResource(projectId) : undefined;
      if (dashboardResources.workspaces.uri === uri) return dashboardResources.workspaces;
      return board?.uri === uri ? board : synced.get(uri);
    },
    list: (query) => {
      refresh();
      const normalizedQuery = query.trim().toLowerCase();
      return [...synced.values()]
        .filter((resource) => !normalizedQuery || resource.label?.toLowerCase().includes(normalizedQuery))
        .map((resource) => ({ resource, group: "Tickets" }));
    },
  };

  return { provider, connectWorkspace };
};
