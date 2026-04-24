import { useEffect } from "react";
import type { TicketStatus } from "@/features/ticket-list/types";

export const shouldHandleCreateTicketShortcutRequest = (input: {
  projectId: string | undefined;
  createTicketRequestKey: number;
  lastHandledCreateTicketRequestKey: number;
}) => {
  const { projectId, createTicketRequestKey, lastHandledCreateTicketRequestKey } = input;
  if (!projectId) return false;
  if (createTicketRequestKey === 0) return false;

  return createTicketRequestKey > lastHandledCreateTicketRequestKey;
};

export const handleCreateTicketShortcutRequest = (input: {
  projectId: string | undefined;
  createTicketRequestKey: number;
  lastHandledCreateTicketRequestKey: number;
  firstCreatableStatus: TicketStatus | null;
  setCreateModalStatus: (status: TicketStatus | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  acknowledgeCreateTicketRequest: (requestKey: number) => void;
}) => {
  const {
    projectId,
    createTicketRequestKey,
    lastHandledCreateTicketRequestKey,
    firstCreatableStatus,
    setCreateModalStatus,
    setCreateModalOpen,
    acknowledgeCreateTicketRequest,
  } = input;
  const shouldHandle = shouldHandleCreateTicketShortcutRequest({
    projectId,
    createTicketRequestKey,
    lastHandledCreateTicketRequestKey,
  });
  if (!shouldHandle) return false;

  setCreateModalStatus(firstCreatableStatus);
  setCreateModalOpen(true);
  acknowledgeCreateTicketRequest(createTicketRequestKey);
  return true;
};

export const useCreateTicketShortcut = (input: {
  projectId: string | undefined;
  createTicketRequestKey: number;
  lastHandledCreateTicketRequestKey: number;
  firstCreatableStatus: TicketStatus | null;
  setCreateModalStatus: (status: TicketStatus | null) => void;
  setCreateModalOpen: (open: boolean) => void;
  acknowledgeCreateTicketRequest: (requestKey: number) => void;
}) => {
  const {
    projectId,
    createTicketRequestKey,
    lastHandledCreateTicketRequestKey,
    firstCreatableStatus,
    setCreateModalStatus,
    setCreateModalOpen,
    acknowledgeCreateTicketRequest,
  } = input;

  useEffect(() => {
    handleCreateTicketShortcutRequest({
      projectId,
      createTicketRequestKey,
      lastHandledCreateTicketRequestKey,
      firstCreatableStatus,
      setCreateModalStatus,
      setCreateModalOpen,
      acknowledgeCreateTicketRequest,
    });
  }, [
    acknowledgeCreateTicketRequest,
    createTicketRequestKey,
    firstCreatableStatus,
    lastHandledCreateTicketRequestKey,
    projectId,
    setCreateModalOpen,
    setCreateModalStatus,
  ]);
};
