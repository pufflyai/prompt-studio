import { useMutation } from "@tanstack/react-query";
import { createProjectTicket } from "@/features/ticket-list/data/api";
import type { TicketStatus } from "@/features/ticket-list/types";

interface CreateProjectTicketInput {
  title: string;
  content?: string | null;
  complexity?: "low" | "medium" | "high" | null;
  tagIds?: string[];
  status?: TicketStatus | null;
  parentId?: string | null;
}

export const useCreateProjectTicket = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: CreateProjectTicketInput) => {
      if (!projectId) throw new Error("Project id is required to create tickets.");
      return createProjectTicket({ projectId, ...input });
    },
  });
