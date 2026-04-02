import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CreateTicketModalPayload } from "@/features/ticket-list/components/create-ticket-modal";
import { uploadTicketFile } from "@/features/ticket-list/data/api/files";
import { useCreateProjectTicket } from "@/features/ticket-list/hooks/use-create-project-ticket";
import type { TicketStatus, TicketTag } from "@/features/ticket-list/types";
import { logMutationError } from "@/lib/error-handlers";

interface UseSubTicketCreationInput {
  projectId: string | undefined;
  parentTicketId: string;
  statusOptions: Array<{ name: string; canCreate: boolean }>;
  tags: TicketTag[];
}

export const useSubTicketCreation = (input: UseSubTicketCreationInput) => {
  const { projectId, parentTicketId, statusOptions, tags } = input;
  const navigate = useNavigate();
  const createTicket = useCreateProjectTicket(projectId);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<TicketStatus | null>(null);

  const firstCreatableStatus = statusOptions.find((status) => status.canCreate)?.name ?? null;

  const openCreateSubTicketModal = () => {
    setCreateModalStatus(firstCreatableStatus);
    setCreateModalOpen(true);
  };

  const closeCreateSubTicketModal = () => {
    setCreateModalOpen(false);
    setCreateModalStatus(null);
  };

  const handleCreateSubTicket = async (payload: CreateTicketModalPayload) => {
    if (!projectId || createTicket.isPending) return;

    try {
      const createdTicket = await createTicket.mutateAsync({
        title: payload.content,
        content: payload.content,
        tagIds: payload.tagIds,
        status: payload.status,
        parentId: payload.parentId,
      });

      closeCreateSubTicketModal();

      if (payload.files.length > 0) {
        try {
          await Promise.all(payload.files.map((file) => uploadTicketFile(createdTicket.id, file)));
        } catch (error) {
          logMutationError("sub-ticket file upload", error);
        }
      }

      navigate({
        to: "/projects/$projectId/tickets/$ticketShorthand",
        params: { projectId, ticketShorthand: createdTicket.shorthand },
      });
    } catch (error) {
      logMutationError("create sub-ticket", error);
    }
  };

  return {
    createModalOpen,
    createModalStatus,
    openCreateSubTicketModal,
    closeCreateSubTicketModal,
    handleCreateSubTicket,
    isCreatingSubTicket: createTicket.isPending,
    parentId: parentTicketId,
    tags,
  };
};
