import { DeleteConfirmationModal } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import { ActionParamsDialog } from "@/features/plugin-actions/components/action-params-dialog";
import type { usePluginActionTrigger } from "@/features/plugin-actions/hooks/use-plugin-action-trigger";
import { CreateWorkspaceModal } from "@/features/ticket/components/create-workspace-modal";

type PluginActionTrigger = ReturnType<typeof usePluginActionTrigger>;

interface TicketDetailsPanelDialogsProps {
  attemptCount: number;
  isCreateWorkspaceOpen: boolean;
  isCreateWorkspaceSubmitting: boolean;
  isDeleteOpen: boolean;
  pluginActionTrigger: PluginActionTrigger;
  projectId?: string;
  sessionActionTrigger: PluginActionTrigger;
  workspaceActionTrigger: PluginActionTrigger;
  workspaceToDeleteId: string | null;
  onCloseCreateWorkspace: () => void;
  onCloseDeleteTicket: () => void;
  onCloseDeleteWorkspace: () => void;
  onConfirmCreateWorkspace: () => boolean | Promise<boolean>;
  onConfirmDeleteTicket: () => Promise<void>;
  onConfirmDeleteWorkspace: () => Promise<void>;
}

export const TicketDetailsPanelDialogs = (props: TicketDetailsPanelDialogsProps) => {
  const {
    attemptCount,
    isCreateWorkspaceOpen,
    isCreateWorkspaceSubmitting,
    isDeleteOpen,
    pluginActionTrigger,
    projectId,
    sessionActionTrigger,
    workspaceActionTrigger,
    workspaceToDeleteId,
    onCloseCreateWorkspace,
    onCloseDeleteTicket,
    onCloseDeleteWorkspace,
    onConfirmCreateWorkspace,
    onConfirmDeleteTicket,
    onConfirmDeleteWorkspace,
  } = props;
  const { t } = useTranslation(["projects", "tickets"]);

  return (
    <>
      {isCreateWorkspaceOpen ? (
        <CreateWorkspaceModal
          open={isCreateWorkspaceOpen}
          attemptCount={attemptCount}
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

      {pluginActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={pluginActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={pluginActionTrigger.activeParamActionIsPending}
          onClose={pluginActionTrigger.cancelParams}
          onSubmit={(params) => pluginActionTrigger.submitWithParams(params)}
        />
      ) : null}

      {workspaceActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={workspaceActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={workspaceActionTrigger.activeParamActionIsPending}
          onClose={workspaceActionTrigger.cancelParams}
          onSubmit={(params) => workspaceActionTrigger.submitWithParams(params)}
        />
      ) : null}

      {sessionActionTrigger.activeParamAction && projectId ? (
        <ActionParamsDialog
          open
          action={sessionActionTrigger.activeParamAction}
          projectId={projectId}
          isSubmitting={sessionActionTrigger.activeParamActionIsPending}
          onClose={sessionActionTrigger.cancelParams}
          onSubmit={(params) => sessionActionTrigger.submitWithParams(params)}
        />
      ) : null}

      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={onCloseDeleteTicket}
        onDelete={onConfirmDeleteTicket}
        headline={t("projects:ticketPanel.deleteConfirmation.ticket.headline")}
        notificationText={t("projects:ticketPanel.deleteConfirmation.ticket.notification")}
        buttonText={t("projects:ticketPanel.options.deleteTicket")}
      />

      <DeleteConfirmationModal
        open={Boolean(workspaceToDeleteId)}
        onClose={onCloseDeleteWorkspace}
        onDelete={onConfirmDeleteWorkspace}
        headline={t("workspacePanel.deleteConfirmation.workspace.headline")}
        notificationText={t("workspacePanel.deleteConfirmation.workspace.notification")}
        buttonText={t("workspacePanel.options.deleteWorkspace")}
      />
    </>
  );
};
