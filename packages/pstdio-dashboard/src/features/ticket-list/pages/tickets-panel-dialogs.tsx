import { DeleteConfirmationModal } from "@pstdio/ui";
import type { TicketStatus, TicketStatusOption, TicketTag } from "@/features/ticket-list/types";
import { CreateTicketModal, type CreateTicketModalPayload } from "../components/create-ticket-modal";

interface TicketsPanelDialogsProps {
  createModalOpen: boolean;
  createModalStatus: TicketStatus | null;
  deleteTicketId: string | null;
  isCreateTicketSubmitting: boolean;
  projectId?: string;
  projectName?: string;
  statusOptions: TicketStatusOption[];
  tags: TicketTag[];
  t: (key: string) => string;
  onCloseCreateModal: () => void;
  onCloseDeleteTicket: () => void;
  onConfirmDeleteTicket: () => Promise<void>;
  onCreateTicket: (payload: CreateTicketModalPayload) => Promise<void>;
}

export const TicketsPanelDialogs = (props: TicketsPanelDialogsProps) => {
  const {
    createModalOpen,
    createModalStatus,
    deleteTicketId,
    isCreateTicketSubmitting,
    projectId,
    projectName,
    statusOptions,
    tags,
    t,
    onCloseCreateModal,
    onCloseDeleteTicket,
    onConfirmDeleteTicket,
    onCreateTicket,
  } = props;

  return (
    <>
      <CreateTicketModal
        key={projectId ?? "global"}
        open={createModalOpen}
        onClose={onCloseCreateModal}
        onSubmit={onCreateTicket}
        isSubmitting={isCreateTicketSubmitting}
        targetStatus={createModalStatus}
        tags={tags}
        projectName={projectName}
        statusOptions={statusOptions}
      />

      <DeleteConfirmationModal
        open={Boolean(deleteTicketId)}
        onClose={onCloseDeleteTicket}
        onDelete={onConfirmDeleteTicket}
        headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
        notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
        buttonText={t("projects:ticketPanel.options.deleteTicket")}
      />
    </>
  );
};
