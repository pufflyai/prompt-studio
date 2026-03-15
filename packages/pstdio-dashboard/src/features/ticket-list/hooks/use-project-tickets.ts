import { useMutation } from "@tanstack/react-query";
import type { StatusResponse, TagResponse } from "pstdio-api/dto";
import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import {
  createProjectTicketTag,
  deleteProjectTicket,
  deleteProjectTicketTag,
  updateProjectTicket,
  updateProjectTicketStatus,
  updateProjectTicketTagDefinition,
  updateProjectTicketTags,
} from "@/features/ticket-list/data/api";
import { toTicketStatusOption, toTicketTag } from "@/features/ticket-list/data/api/mappers";
import type { Ticket, TicketStatus, TicketStatusColor, TicketTag } from "@/features/ticket-list/types";
import { buildSessionsByWorkspace } from "@/features/ticket-list/utils/sessions-by-workspace";
import { toTicketFromRow } from "./ticket-row-mappers";

const DEFAULT_STATUS_COLOR: TicketStatusColor = "gray";
const DEFAULT_STATUS_NAME = "Unassigned";

const buildStatusMetadata = (rawStatuses: SyncedRow[] | undefined) => {
  const statuses = [...(rawStatuses ?? [])].sort((a, b) => (a.sort_order as number) - (b.sort_order as number));
  const options = statuses.map((status) => toTicketStatusOption(status as unknown as StatusResponse));
  const defaultStatus = options.find((status) => status.isDefault) ?? options[0];

  return {
    fallbackName: defaultStatus?.name ?? DEFAULT_STATUS_NAME,
    fallbackColor: defaultStatus?.color ?? DEFAULT_STATUS_COLOR,
    statusById: new Map(options.map((status) => [status.id, status.name])),
    colorById: new Map(options.map((status) => [status.id, status.color])),
  };
};

const buildTagIdsByTicket = (rawTagAssignments: SyncedRow[] | undefined, ticketIds: Set<string>) => {
  const tagIdsByTicket = new Map<string, string[]>();

  for (const assignment of rawTagAssignments ?? []) {
    if (!ticketIds.has(assignment.ticket_id as string)) continue;
    const ticketId = assignment.ticket_id as string;
    const existing = tagIdsByTicket.get(ticketId) ?? [];
    existing.push(assignment.ticket_tag_id as string);
    tagIdsByTicket.set(ticketId, existing);
  }

  return tagIdsByTicket;
};

const buildWorkspacesByTicket = (
  rawTicketWorkspaces: SyncedRow[] | undefined,
  rawWorkspaces: SyncedRow[] | undefined,
) => {
  const workspaceById = new Map((rawWorkspaces ?? []).map((workspace) => [workspace.id, workspace]));
  const workspacesByTicket = new Map<string, SyncedRow[]>();

  for (const ticketWorkspace of rawTicketWorkspaces ?? []) {
    const workspaceId = ticketWorkspace.workspace_id as string;
    const workspace = workspaceById.get(workspaceId);
    if (!workspace) continue;

    const ticketId = ticketWorkspace.ticket_id as string;
    const existing = workspacesByTicket.get(ticketId) ?? [];
    existing.push(workspace);
    workspacesByTicket.set(ticketId, existing);
  }

  return workspacesByTicket;
};

const buildSubTicketsByParent = (rawTickets: SyncedRow[]) => {
  const subTicketsByParent = new Map<string, SyncedRow[]>();

  for (const ticket of rawTickets) {
    const parentId = ticket.parent_id as string | null;
    if (!parentId) continue;

    const existing = subTicketsByParent.get(parentId) ?? [];
    existing.push(ticket);
    subTicketsByParent.set(parentId, existing);
  }

  return subTicketsByParent;
};

export const useProjectTickets = (projectId: string | undefined) => {
  const { data: rawTicketsData, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ t: getCollection("tickets") })
            .where(({ t }) => eq(t.project_id, projectId))
            .select(({ t }) => ({ ...t }))
        : undefined,
    [projectId],
  );
  const rawTickets = asSyncedRows(rawTicketsData);

  const { data: rawStatusesData } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("ticket_statuses") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );

  const { data: rawTagAssignmentsData } = useLiveQuery((q) =>
    q.from({ ta: getCollection("ticket_tag_assignments") }).select(({ ta }) => ({ ...ta })),
  );

  const { data: rawTicketWorkspacesData } = useLiveQuery((q) =>
    q.from({ tw: getCollection("ticket_workspaces") }).select(({ tw }) => ({ ...tw })),
  );

  const { data: rawWorkspacesData } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ w: getCollection("workspaces") })
            .where(({ w }) => eq(w.project_id, projectId))
            .select(({ w }) => ({ ...w }))
        : undefined,
    [projectId],
  );

  const { data: rawSessionsData } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("sessions") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );

  if (!rawTickets || !projectId) return { data: undefined, isLoading };

  const rawStatuses = asSyncedRows(rawStatusesData);
  const rawTagAssignments = asSyncedRows(rawTagAssignmentsData);
  const rawTicketWorkspaces = asSyncedRows(rawTicketWorkspacesData);
  const rawWorkspaces = asSyncedRows(rawWorkspacesData);
  const rawSessions = asSyncedRows(rawSessionsData);

  const statusMetadata = buildStatusMetadata(rawStatuses);

  const ticketIds = new Set(rawTickets.map((t) => t.id));
  const tagIdsByTicket = buildTagIdsByTicket(rawTagAssignments, ticketIds);
  const workspacesByTicket = buildWorkspacesByTicket(rawTicketWorkspaces, rawWorkspaces);
  const sessionsByWorkspace = buildSessionsByWorkspace(rawWorkspaces, rawSessions);
  const subTicketsByParent = buildSubTicketsByParent(rawTickets);

  const data = rawTickets.map((t) =>
    toTicketFromRow(
      t,
      statusMetadata.statusById,
      statusMetadata.colorById,
      statusMetadata.fallbackName,
      statusMetadata.fallbackColor,
      tagIdsByTicket,
      workspacesByTicket,
      sessionsByWorkspace,
      subTicketsByParent,
    ),
  );

  return { data, isLoading };
};

export const useProjectTicketStatuses = (projectId: string | undefined) => {
  const { data: rawStatusesData, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("ticket_statuses") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );
  const rawStatuses = asSyncedRows(rawStatusesData);

  const data = rawStatuses
    ? [...rawStatuses]
        .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
        .map((s) => toTicketStatusOption(s as unknown as StatusResponse))
    : undefined;

  return { data, isLoading };
};

export const useProjectTicketTags = (projectId: string | undefined) => {
  const { data: rawTagsData, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ t: getCollection("ticket_tags") })
            .where(({ t }) => eq(t.project_id, projectId))
            .select(({ t }) => ({ ...t }))
        : undefined,
    [projectId],
  );
  const rawTags = asSyncedRows(rawTagsData);

  const data = rawTags?.map((t) => toTicketTag(t as unknown as TagResponse));

  return { data, isLoading };
};

export const useUpdateProjectTicket = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: {
      ticketId: string;
      title?: string;
      content?: string;
      complexity?: "low" | "medium" | "high" | null;
      archived?: boolean;
    }) => {
      if (!projectId) throw new Error("Project id is required to update tickets.");
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) body.display_title = input.title;
      if (input.content !== undefined) body.content = input.content;
      if (input.complexity !== undefined) body.complexity = input.complexity;
      if (input.archived !== undefined) body.archived = input.archived;
      await updateProjectTicket(projectId, input.ticketId, body as Parameters<typeof updateProjectTicket>[2]);
    },
  });

export const useUpdateProjectTicketStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      if (!projectId) throw new Error("Project id is required to update tickets.");
      await updateProjectTicketStatus(projectId, { id: ticketId } as Ticket, status);
    },
  });

export const useDeleteProjectTicket = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async ({ ticketId }: { ticketId: string }) => {
      if (!projectId) throw new Error("Project id is required to delete tickets.");
      await deleteProjectTicket(projectId, ticketId);
    },
  });

export const useUpdateProjectTicketTags = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async ({ ticketId, tagIds }: { ticketId: string; tagIds: string[] }) => {
      if (!projectId) throw new Error("Project id is required to update ticket tags.");
      await updateProjectTicketTags(ticketId, tagIds);
    },
  });

export const useCreateProjectTicketTag = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { name: string; color: TicketStatusColor }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectTicketTag(projectId, input);
    },
  });

export const useUpdateProjectTicketTag = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { tag: TicketTag; name: string; color: TicketStatusColor }) => {
      if (!projectId) throw new Error("Project id is required.");
      return updateProjectTicketTagDefinition(projectId, input.tag.id, { name: input.name, color: input.color });
    },
  });

export const useDeleteProjectTicketTag = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (tagId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTicketTag(projectId, tagId);
    },
  });
