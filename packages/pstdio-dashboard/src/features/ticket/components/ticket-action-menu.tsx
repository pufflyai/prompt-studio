import { Icon, IconButton, Menu } from "@chakra-ui/react";
import { DeleteConfirmationModal, MenuItem } from "@pstdio/ui";
import { Archive, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ActionDescriptor } from "@/features/plugin-actions/api";

interface TicketActionMenuProps {
  isArchived: boolean;
  canDeleteTicket: boolean;
  pluginActions?: ActionDescriptor[];
  onCreateSubTicket: () => void;
  onBreakIntoSubTickets: () => void;
  onRefineTicket: () => void;
  onArchiveTicket: () => void;
  onDeleteTicket: () => void | Promise<void>;
  onPluginAction?: (actionKey: string) => void;
}

export const TicketActionMenu = (props: TicketActionMenuProps) => {
  const {
    isArchived,
    canDeleteTicket,
    pluginActions: _pluginActions = [],
    onCreateSubTicket,
    onBreakIntoSubTickets,
    onRefineTicket,
    onArchiveTicket,
    onDeleteTicket,
    onPluginAction: _onPluginAction,
  } = props;
  const { t } = useTranslation("projects");
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const handleOpenDelete = () => {
    if (!canDeleteTicket) {
      return;
    }

    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    await onDeleteTicket();
    setDeleteOpen(false);
  };

  /* const overflowActions = pluginActions.filter((a) => a.placement === "overflow"); */

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton aria-label={t("ticketPanel.options.ticket")} variant="ghost" size="sm">
            <Icon as={MoreHorizontal} boxSize="18px" />
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="200px" bg="bg">
            <MenuItem
              primaryLabel={t("ticketPanel.options.createSubTicket")}
              leftIcon={Plus}
              onClick={onCreateSubTicket}
            />
            <MenuItem
              primaryLabel={t("ticketPanel.options.breakIntoSubTickets")}
              leftIcon={Sparkles}
              onClick={onBreakIntoSubTickets}
            />
            <MenuItem
              primaryLabel={t("ticketPanel.options.refineTicket")}
              leftIcon={Sparkles}
              onClick={onRefineTicket}
            />
            {/* overflowActions.map((action) => (
              <MenuItem
                key={action.key}
                primaryLabel={action.label}
                leftIcon={Play}
                onClick={() => onPluginAction?.(action.key)}
              />
            )) */}
            <MenuItem
              primaryLabel={t(isArchived ? "ticketPanel.options.unarchiveTicket" : "ticketPanel.options.archiveTicket")}
              leftIcon={Archive}
              onClick={onArchiveTicket}
            />
            <MenuItem
              primaryLabel={t("ticketPanel.options.deleteTicket")}
              leftIcon={Trash2}
              onClick={handleOpenDelete}
              isDisabled={!canDeleteTicket}
            />
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
      <DeleteConfirmationModal
        open={isDeleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDelete={handleDelete}
        headline={t("ticketPanel.deleteConfirmation.ticket.headline")}
        notificationText={t("ticketPanel.deleteConfirmation.ticket.notification")}
        buttonText={t("ticketPanel.options.deleteTicket")}
      />
    </>
  );
};
