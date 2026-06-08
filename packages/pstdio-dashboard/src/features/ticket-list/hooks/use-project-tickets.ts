import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import {
  createProjectStatus,
  createProjectTicketTag,
  createTagOption,
  deleteProjectTicket,
  deleteProjectTicketStatus,
  deleteProjectTicketTag,
  deleteTagOption,
  getProjectTicketStatuses,
  getProjectTickets,
  getProjectTicketTags,
  setProjectDefaultStatus,
  updateProjectStatus,
  updateProjectTicket,
  updateProjectTicketStatus,
  updateProjectTicketTagDefinition,
  updateProjectTicketTags,
  updateTagOption,
} from "@/features/ticket-list/data/api";
import {
  readPlannerWorkspaceStatuses,
  ticketShorthandFromWorkspace,
  toTicketAttemptFromWorkspace,
} from "@/features/ticket-list/data/api/planner";
import type { Ticket, TicketStatus, TicketStatusColor } from "@/features/ticket-list/types";
import { buildSessionsByWorkspace } from "@/features/ticket-list/utils/sessions-by-workspace";

const ticketQueryKey = (projectId: string | undefined) => ["planner-tickets", projectId] as const;
const ticketStatusesQueryKey = (projectId: string | undefined) => ["planner-ticket-statuses", projectId] as const;
const ticketTagsQueryKey = (projectId: string | undefined) => ["planner-ticket-tags", projectId] as const;
const workspaceStatusesQueryKey = (projectId: string | undefined) => ["planner-workspace-statuses", projectId] as const;

const useInvalidatePlannerTicketData = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ticketQueryKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: ticketStatusesQueryKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: ticketTagsQueryKey(projectId) }),
    ]);
  };
};

const useProjectWorkspaceRows = (projectId: string | undefined) => {
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
  return asSyncedRows(rawWorkspacesData) ?? [];
};

const useProjectSessionRows = (projectId: string | undefined) => {
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

  return {
    sessions: asSyncedRows(rawSessionsData),
    workspaceSessions: asSyncedRows(rawWorkspaceSessionsData),
  };
};

const addSubTickets = (tickets: Ticket[]) => {
  const statusById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  return tickets.map((ticket) => ({
    ...ticket,
    subTickets: tickets
      .filter((candidate) => candidate.parentId === ticket.id)
      .map((candidate) => ({
        id: candidate.id,
        shorthand: candidate.shorthand,
        title: candidate.title,
        statusId: statusById.get(candidate.id)?.status ?? null,
        status: candidate.status,
        statusColor: candidate.statusColor,
      })),
  }));
};

export const useProjectTickets = (projectId: string | undefined) => {
  const workspaces = useProjectWorkspaceRows(projectId);
  // Fetch every workspace status value for the project (empty id list = all) and
  // key only on projectId, so adding/removing a workspace neither churns the cache
  // nor blanks attempt-status pills while a per-id key refetches.
  const workspaceStatusQuery = useQuery({
    queryKey: workspaceStatusesQueryKey(projectId),
    queryFn: () => readPlannerWorkspaceStatuses(projectId!, []),
    enabled: Boolean(projectId),
  });
  const { sessions, workspaceSessions } = useProjectSessionRows(projectId);
  const sessionsByWorkspace = buildSessionsByWorkspace(workspaceSessions, sessions);
  const ticketsQuery = useQuery({
    queryKey: ticketQueryKey(projectId),
    queryFn: () => getProjectTickets(projectId!),
    enabled: Boolean(projectId),
  });

  if (!projectId) return { data: undefined, sessionsByWorkspace, isLoading: false };

  const workspaceStatusValues = workspaceStatusQuery.data?.valuesByWorkspaceId ?? {};
  const workspacesByTicket = new Map<string, typeof workspaces>();
  for (const workspace of workspaces) {
    const shorthand = ticketShorthandFromWorkspace(workspace);
    if (!shorthand || workspace.archived) continue;
    const existing = workspacesByTicket.get(shorthand) ?? [];
    existing.push(workspace);
    workspacesByTicket.set(shorthand, existing);
  }

  const tickets = (ticketsQuery.data ?? []).map((ticket) => {
    const attempts = (workspacesByTicket.get(ticket.shorthand) ?? [])
      .sort((left, right) => String(left.workspace_shorthand).localeCompare(String(right.workspace_shorthand)))
      .map((workspace) => toTicketAttemptFromWorkspace(workspace, sessionsByWorkspace, workspaceStatusValues));
    return { ...ticket, attempts };
  });

  return {
    data: addSubTickets(tickets),
    sessionsByWorkspace,
    isLoading: ticketsQuery.isLoading || workspaceStatusQuery.isLoading,
  };
};

export const useProjectTicketStatuses = (projectId: string | undefined) =>
  useQuery({
    queryKey: ticketStatusesQueryKey(projectId),
    queryFn: () => getProjectTicketStatuses(projectId!),
    enabled: Boolean(projectId),
  });

export const useProjectTicketTags = (projectId: string | undefined) =>
  useQuery({
    queryKey: ticketTagsQueryKey(projectId),
    queryFn: () => getProjectTicketTags(projectId!),
    enabled: Boolean(projectId),
  });

export const useUpdateProjectTicket = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: { ticketId: string; title?: string; content?: string; archived?: boolean }) => {
      if (!projectId) throw new Error("Project id is required to update tickets.");
      await updateProjectTicket(projectId, input.ticketId, input);
    },
    onSuccess: invalidate,
  });
};

export const useUpdateProjectTicketStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      if (!projectId) throw new Error("Project id is required to update tickets.");
      await updateProjectTicketStatus(projectId, { id: ticketId } as Ticket, status);
    },
    onSuccess: invalidate,
  });
};

export const useDeleteProjectTicket = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async ({ ticketId }: { ticketId: string }) => {
      if (!projectId) throw new Error("Project id is required to delete tickets.");
      await deleteProjectTicket(projectId, ticketId);
    },
    onSuccess: invalidate,
  });
};

export const useUpdateProjectTicketTags = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async ({ ticketId, tagIds }: { ticketId: string; tagIds: string[] }) => {
      if (!projectId) throw new Error("Project id is required to update ticket tags.");
      await updateProjectTicketTags(projectId, ticketId, tagIds);
    },
    onSuccess: invalidate,
  });
};

export const useCreateProjectTicketTag = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: {
      name: string;
      type: "single_select" | "multi_select";
      options?: { name: string; color: string }[];
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectTicketTag(projectId, input);
    },
    onSuccess: invalidate,
  });
};

export const useUpdateProjectTicketTag = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: { tagId: string; name?: string; type?: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return updateProjectTicketTagDefinition(projectId, input.tagId, { name: input.name, type: input.type });
    },
    onSuccess: invalidate,
  });
};

export const useDeleteProjectTicketTag = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTicketTag(projectId, tagId);
    },
    onSuccess: invalidate,
  });
};

export const useCreateProjectTicketStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: { name: string; color: TicketStatusColor }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createProjectStatus(projectId, input);
    },
    onSuccess: invalidate,
  });
};

export const useUpdateProjectTicketStatusDefinition = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
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
    onSuccess: invalidate,
  });
};

export const useSetProjectDefaultTicketStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (statusId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await setProjectDefaultStatus(projectId, statusId);
    },
    onSuccess: invalidate,
  });
};

export const useDeleteProjectTicketStatusDefinition = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (statusId: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectTicketStatus(projectId, statusId);
    },
    onSuccess: invalidate,
  });
};

export const useCreateTagOption = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: { tagId: string; name: string; color: string; icon?: string; description?: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createTagOption(projectId, input.tagId, {
        name: input.name,
        color: input.color,
        icon: input.icon,
        description: input.description,
      });
    },
    onSuccess: invalidate,
  });
};

export const useUpdateTagOption = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
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
    onSuccess: invalidate,
  });
};

export const useDeleteTagOption = (projectId: string | undefined) => {
  const invalidate = useInvalidatePlannerTicketData(projectId);
  return useMutation({
    mutationFn: async (input: { tagId: string; optionId: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteTagOption(projectId, input.tagId, input.optionId);
    },
    onSuccess: invalidate,
  });
};
