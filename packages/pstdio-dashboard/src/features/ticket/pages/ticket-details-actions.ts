import { Archive, Trash2 } from "lucide-react";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { formatTicketBreadcrumbLabel } from "../utils/ticket-breadcrumb";

export const buildTicketBreadcrumbs = (input: {
  ticketShorthand: string;
  ticketTitle: string;
  parentShorthand: string | null;
  parentTitle: string | null;
  projectId: string;
}) => {
  const { ticketShorthand, ticketTitle, parentShorthand, parentTitle, projectId } = input;
  const ticketUrl = `/projects/${projectId}/tickets/${ticketShorthand}`;
  const breadcrumbs = [{ title: formatTicketBreadcrumbLabel(ticketShorthand, ticketTitle), url: ticketUrl }];
  if (!parentShorthand) return breadcrumbs;

  const parentUrl = `/projects/${projectId}/tickets/${parentShorthand}`;
  return [{ title: formatTicketBreadcrumbLabel(parentShorthand, parentTitle), url: parentUrl }, ...breadcrumbs];
};

export const buildWorkspaceRoute = (projectId: string, ticketShorthand: string, workspaceShorthand: string) => ({
  to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand" as const,
  params: { projectId, ticketShorthand, workspaceShorthand },
});

interface BuildOverflowActionsInput {
  ticket: { id: string; archived?: boolean };
  projectId: string | undefined;
  updateTicket: { isPending: boolean; mutate: (input: { ticketId: string; archived: boolean }) => void };
  deleteTicket: { isPending: boolean };
  onDeleteOpen: () => void;
  t: (key: string) => string;
}

export const buildTicketOverflowActions = (input: BuildOverflowActionsInput): HeaderActionItem[] => {
  const { ticket, projectId, updateTicket, deleteTicket, onDeleteOpen, t } = input;
  return [
    {
      key: "archive-ticket",
      label: t(
        ticket.archived ? "projects:ticketPanel.options.unarchiveTicket" : "projects:ticketPanel.options.archiveTicket",
      ),
      kind: "default",
      icon: Archive,
      isDisabled: updateTicket.isPending,
      onClick: () => updateTicket.mutate({ ticketId: ticket.id, archived: !ticket.archived }),
    },
    {
      key: "delete-ticket",
      label: t("projects:ticketPanel.options.deleteTicket"),
      kind: "default",
      icon: Trash2,
      isDisabled: !projectId || deleteTicket.isPending,
      onClick: onDeleteOpen,
    },
  ];
};
