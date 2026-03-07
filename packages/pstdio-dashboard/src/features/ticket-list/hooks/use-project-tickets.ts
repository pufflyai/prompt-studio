import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import type { Project } from "@/features/project/types";
import {
  createProjectTicketTag,
  deleteProjectTicket,
  deleteProjectTicketTag,
  getProjectTicketStatuses,
  getProjectTickets,
  getProjectTicketTags,
  updateProjectTicket,
  updateProjectTicketStatus,
  updateProjectTicketTagDefinition,
  updateProjectTicketTags,
} from "@/features/ticket-list/data/api";
import type { Ticket, TicketStatus, TicketStatusColor, TicketTag } from "@/features/ticket-list/types";
import { moveTicket } from "@/features/ticket-list/utils/ticket-mutations";

export const useProjectTickets = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.tickets(projectId ?? ""),
    queryFn: () => getProjectTickets(projectId ?? ""),
    enabled: Boolean(projectId),
  });

export const useProjectTicketStatuses = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.ticketStatuses(projectId ?? ""),
    queryFn: () => getProjectTicketStatuses(projectId ?? ""),
    enabled: Boolean(projectId),
  });

export const useProjectTicketTags = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectKeys.ticketTags(projectId ?? ""),
    queryFn: () => getProjectTicketTags(projectId ?? ""),
    enabled: Boolean(projectId),
  });

type UpdateProjectTicketInput = {
  ticketId: string;
  title?: string;
  content?: string;
  complexity?: "low" | "medium" | "high" | null;
  archived?: boolean;
};

const applyTicketUpdate = (ticket: Ticket, input: UpdateProjectTicketInput) => ({
  ...ticket,
  title: input.title ?? ticket.title,
  content: input.content ?? ticket.content,
  complexity: input.complexity === undefined ? ticket.complexity : input.complexity,
  archived: input.archived === undefined ? ticket.archived : input.archived,
});

export const useUpdateProjectTicket = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectTicketInput) => {
      if (!projectId) {
        throw new Error("Project id is required to update tickets.");
      }
      const tickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId)) ?? [];
      const ticket = tickets.find((item) => item.id === input.ticketId);

      if (!ticket) {
        throw new Error("Ticket not found.");
      }

      return updateProjectTicket(projectId, applyTicketUpdate(ticket, input));
    },
    onMutate: async (input) => {
      if (!projectId) {
        return { previousTickets: undefined };
      }

      await queryClient.cancelQueries({ queryKey: projectKeys.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId));
      const nextTickets = previousTickets
        ? previousTickets.map((ticket) => (ticket.id === input.ticketId ? applyTicketUpdate(ticket, input) : ticket))
        : previousTickets;

      if (nextTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), nextTickets);
      }

      return { previousTickets };
    },
    onError: (_error, _variables, context) => {
      if (!projectId) return;
      if (context?.previousTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), context.previousTickets);
      }
    },
    onSettled: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      return queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useUpdateProjectTicketStatus = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      if (!projectId) {
        throw new Error("Project id is required to update tickets.");
      }
      const tickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId)) ?? [];
      const ticket = tickets.find((item) => item.id === ticketId);

      if (!ticket) {
        throw new Error("Ticket not found.");
      }

      return updateProjectTicketStatus(projectId, ticket, status);
    },
    onMutate: async ({ ticketId, status }) => {
      if (!projectId) {
        return { previousTickets: undefined };
      }

      await queryClient.cancelQueries({ queryKey: projectKeys.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId));
      const nextTickets = previousTickets ? moveTicket(previousTickets, ticketId, status) : previousTickets;

      if (nextTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), nextTickets);
      }

      return { previousTickets };
    },
    onError: (_error, _variables, context) => {
      if (!projectId) return;
      if (context?.previousTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), context.previousTickets);
      }
    },
    onSettled: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      return queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useDeleteProjectTicket = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId }: { ticketId: string }) => {
      if (!projectId) {
        throw new Error("Project id is required to delete tickets.");
      }
      return deleteProjectTicket(projectId, ticketId);
    },
    onMutate: async ({ ticketId }) => {
      if (!projectId) {
        return { previousTickets: undefined, previousProject: undefined };
      }

      await queryClient.cancelQueries({ queryKey: projectKeys.tickets(projectId) });
      await queryClient.cancelQueries({ queryKey: projectKeys.detail(projectId) });

      const previousTickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId));
      const previousProject = queryClient.getQueryData<Project | null>(projectKeys.detail(projectId));

      const nextTickets = previousTickets
        ? previousTickets.filter((ticket) => ticket.id !== ticketId)
        : previousTickets;
      if (nextTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), nextTickets);
      }

      return { previousTickets, previousProject };
    },
    onError: (_error, _variables, context) => {
      if (!projectId) return;
      if (context?.previousTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), context.previousTickets);
      }
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.detail(projectId), context.previousProject);
      }
    },
    onSettled: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useUpdateProjectTicketTags = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, tagIds }: { ticketId: string; tagIds: string[] }) => {
      if (!projectId) {
        throw new Error("Project id is required to update ticket tags.");
      }
      return updateProjectTicketTags(ticketId, tagIds);
    },
    onMutate: async ({ ticketId, tagIds }) => {
      if (!projectId) {
        return { previousTickets: undefined };
      }

      await queryClient.cancelQueries({ queryKey: projectKeys.tickets(projectId) });
      const previousTickets = queryClient.getQueryData<Ticket[]>(projectKeys.tickets(projectId));
      const nextTickets = previousTickets
        ? previousTickets.map((ticket) => (ticket.id === ticketId ? { ...ticket, tagIds } : ticket))
        : previousTickets;

      if (nextTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), nextTickets);
      }

      return { previousTickets };
    },
    onError: (_error, _variables, context) => {
      if (!projectId) return;
      if (context?.previousTickets) {
        queryClient.setQueryData(projectKeys.tickets(projectId), context.previousTickets);
      }
    },
    onSettled: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
      return queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useCreateProjectTicketTag = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; color: TicketStatusColor }) => {
      if (!projectId) {
        throw new Error("Project id is required.");
      }
      return createProjectTicketTag(projectId, input);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.ticketTags(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useUpdateProjectTicketTag = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { tag: TicketTag; name: string; color: TicketStatusColor }) => {
      if (!projectId) {
        throw new Error("Project id is required.");
      }
      return updateProjectTicketTagDefinition(projectId, input.tag.id, { name: input.name, color: input.color });
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.ticketTags(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
};

export const useDeleteProjectTicketTag = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tagId: string) => {
      if (!projectId) {
        throw new Error("Project id is required.");
      }
      await deleteProjectTicketTag(projectId, tagId);
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.ticketTags(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.tickets(projectId) });
    },
  });
};
