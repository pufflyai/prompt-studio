import { DeleteConfirmationModal } from "@pstdio/ui";
import type { ReactNode } from "react";
import { CreateWorkspaceModal } from "../components/create-workspace-modal";

interface TicketDetailsDialogsProps {
  isCreateWorkspaceOpen: boolean;
  attemptsCount: number;
  isCreateWorkspaceSubmitting: boolean;
  onCloseCreateWorkspace: () => void;
  onConfirmCreateWorkspace: () => Promise<boolean>;
  ticketContextMenuParamsDialog: ReactNode;
  workspaceContextMenuParamsDialog: ReactNode;
  isTicketDeleteOpen: boolean;
  onCloseTicketDelete: () => void;
  onDeleteTicket: () => Promise<void>;
  isWorkspaceDeleteOpen: boolean;
  onCloseWorkspaceDelete: () => void;
  onDeleteWorkspace: () => Promise<void>;
  t: (key: string, options?: Record<string, string>) => string;
}

export const TicketDetailsDialogs = (props: TicketDetailsDialogsProps) => {
  const {
    isCreateWorkspaceOpen,
    attemptsCount,
    isCreateWorkspaceSubmitting,
    onCloseCreateWorkspace,
    onConfirmCreateWorkspace,
    ticketContextMenuParamsDialog,
    workspaceContextMenuParamsDialog,
    isTicketDeleteOpen,
    onCloseTicketDelete,
    onDeleteTicket,
    isWorkspaceDeleteOpen,
    onCloseWorkspaceDelete,
    onDeleteWorkspace,
    t,
  } = props;

  return (
    <>
      {isCreateWorkspaceOpen ? (
        <CreateWorkspaceModal
          open={isCreateWorkspaceOpen}
          attemptCount={attemptsCount}
          showAgentSelector={false}
          isSubmitting={isCreateWorkspaceSubmitting}
          confirmLabel={t("tickets:createWorkspaceModal.createWorkspace", { defaultValue: "Create workspace" })}
          description={t("tickets:createWorkspaceModal.createWorkspaceDescription", {
            defaultValue: "Create a workspace now and start a session later.",
          })}
          onClose={onCloseCreateWorkspace}
          onConfirm={onConfirmCreateWorkspace}
        />
      ) : null}

      {ticketContextMenuParamsDialog}
      {workspaceContextMenuParamsDialog}

      <DeleteConfirmationModal
        open={isTicketDeleteOpen}
        onClose={onCloseTicketDelete}
        onDelete={onDeleteTicket}
        headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
        notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
        buttonText={t("projects:ticketPanel.options.deleteTicket")}
      />

      <DeleteConfirmationModal
        open={isWorkspaceDeleteOpen}
        onClose={onCloseWorkspaceDelete}
        onDelete={onDeleteWorkspace}
        headline={t("workspacePanel.deleteConfirmation.workspace.headline")}
        notificationText={t("workspacePanel.deleteConfirmation.workspace.notification")}
        buttonText={t("workspacePanel.options.deleteWorkspace")}
      />
    </>
  );
};
