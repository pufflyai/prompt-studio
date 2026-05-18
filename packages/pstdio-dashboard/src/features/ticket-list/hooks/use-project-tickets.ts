import type { Status as StatusResponse, Tag as TagResponse } from "@pstdio/sdk/resources";
import { useMutation } from "@tanstack/react-query";
import { asSyncedRows, eq, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import {
  createProjectStatus,
  createProjectTicketTag,
  createTagOption,
  deleteProjectTicket,
  deleteProjectTicketStatus,
  deleteProjectTicketTag,
  deleteTagOption,
  setProjectDefaultStatus,
  updateProjectStatus,
  updateProjectTicket,
  updateProjectTicketStatus,
  updateProjectTicketTagDefinition,
  updateProjectTicketTags,
  updateTagOption,
} from "@/features/ticket-list/data/api";
import { toTicketStatusOption, toTicketTag } from "@/features/ticket-list/data/api/mappers";
import type { Ticket, TicketStatus, TicketStatusColor } from "@/features/ticket-list/types";
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
    existing.push(assignment.ticket_tag_option_id as string);
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

  const { data: rawWorkspaceSessionsData } = useLiveQuery((q) =>
    q.from({ ws: getCollection("workspace_sessions") }).select(({ ws }) => ({ ...ws })),
  );

  if (!rawTickets || !projectId) return { data: undefined, isLoading };

  const rawStatuses = asSyncedRows(rawStatusesData);
  const rawTagAssignments = asSyncedRows(rawTagAssignmentsData);
  const rawTicketWorkspaces = asSyncedRows(rawTicketWorkspacesData);
  const rawWorkspaces = asSyncedRows(rawWorkspacesData);
  const rawSessions = asSyncedRows(rawSessionsData);
  const rawWorkspaceSessions = asSyncedRows(rawWorkspaceSessionsData);

  const statusMetadata = buildStatusMetadata(rawStatuses);

  const ticketIds = new Set(rawTickets.map((t) => t.id));
  const tagIdsByTicket = buildTagIdsByTicket(rawTagAssignments, ticketIds);
  const workspacesByTicket = buildWorkspacesByTicket(rawTicketWorkspaces, rawWorkspaces);
  const sessionsByWorkspace = buildSessionsByWorkspace(rawWorkspaceSessions, rawSessions);
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

  return { data, sessionsByWorkspace, isLoading };
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

  const { data: rawOptionsData } = useLiveQuery((q) =>
    q.from({ o: getCollection("ticket_tag_options") }).select(({ o }) => ({ ...o })),
  );
  const rawOptions = asSyncedRows(rawOptionsData);

  const data = rawTags?.map((t) => {
    const tagOptions = (rawOptions ?? [])
      .filter((o) => o.tag_id === t.id && !o.deleted_at)
      .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));

    return toTicketTag({
      ...t,
      options: tagOptions.map((o) => ({
        id: o.id as string,
        name: o.name as string,
        color: o.color as string,
        sort_order: o.sort_order as number,
        icon: (o.icon as string) ?? null,
        description: (o.description as string) ?? null,
      })),
    } as unknown as TagResponse);
  });

  return { data, isLoading };
};

export const useUpdateProjectTicket = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { ticketId: string; title?: string; content?: string; archived?: boolean }) => {
      if (!projectId) throw new Error("Project id is required to update tickets.");
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) body.display_title = input.title;
      if (input.content !== undefined) body.content = input.content;
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
    mutationFn: async (input: {
      name: string;
      type: "single_select" | "multi_select";
      options?: { name: string; color: string }[];
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectTicketTag(projectId, input);
    },
  });

export const useUpdateProjectTicketTag = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { tagId: string; name?: string; type?: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return updateProjectTicketTagDefinition(projectId, input.tagId, { name: input.name, type: input.type });
    },
  });

export const useDeleteProjectTicketTag = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (tagId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTicketTag(projectId, tagId);
    },
  });

export const useCreateProjectTicketStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { name: string; color: TicketStatusColor }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectStatus(projectId, input);
    },
  });

export const useUpdateProjectTicketStatusDefinition = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: {
      statusId: string;
      name?: string;
      color?: TicketStatusColor;
      sort_order?: number;
      can_create?: boolean;
      can_drag_in?: boolean;
      can_drag_out?: boolean;
      column_actions?: string[];
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      const { statusId, ...rest } = input;
      return updateProjectStatus(projectId, statusId, rest);
    },
  });

export const useSetProjectDefaultTicketStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (statusId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await setProjectDefaultStatus(projectId, statusId);
    },
  });

export const useDeleteProjectTicketStatusDefinition = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (statusId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTicketStatus(projectId, statusId);
    },
  });

export const useCreateTagOption = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { tagId: string; name: string; color: string; icon?: string; description?: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createTagOption(projectId, input.tagId, {
        name: input.name,
        color: input.color,
        icon: input.icon,
        description: input.description,
      });
    },
  });

export const useUpdateTagOption = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: {
      tagId: string;
      optionId: string;
      name?: string;
      color?: string;
      sort_order?: number;
      icon?: string | null;
      description?: string | null;
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      return updateTagOption(projectId, input.tagId, input.optionId, {
        name: input.name,
        color: input.color,
        sort_order: input.sort_order,
        icon: input.icon,
        description: input.description,
      });
    },
  });

export const useDeleteTagOption = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { tagId: string; optionId: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteTagOption(projectId, input.tagId, input.optionId);
    },
  });
