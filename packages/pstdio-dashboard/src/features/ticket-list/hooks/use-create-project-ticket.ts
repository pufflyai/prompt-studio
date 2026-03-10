import { createProjectTicket } from "@/features/ticket-list/data/api";
import type { TicketStatus } from "@/features/ticket-list/types";
import { useMutation } from "@/lib/use-mutation";

interface CreateProjectTicketInput {
  title: string;
  content?: string | null;
  complexity?: "low" | "medium" | "high" | null;
  status?: TicketStatus | null;
  parentId?: string | null;
}

export const useCreateProjectTicket = (projectId: string | undefined) =>
  useMutation(async (input: CreateProjectTicketInput) => {
    if (!projectId) throw new Error("Project id is required to create tickets.");
    return createProjectTicket({ projectId, ...input });
  });
