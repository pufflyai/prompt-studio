import type { useNavigate } from "@tanstack/react-router";

type Navigate = ReturnType<typeof useNavigate>;

export const navigateToTicketDetails = (navigate: Navigate, projectId: string, ticketShorthand: string) => {
  navigate({
    to: "/projects/$projectId/tickets/$ticketShorthand",
    params: { projectId, ticketShorthand },
  });
};

export const navigateToTicketWorkspace = (
  navigate: Navigate,
  projectId: string,
  ticketShorthand: string,
  workspaceShorthand: string,
) => {
  navigate({
    to: "/projects/$projectId/tickets/$ticketShorthand/workspaces/$workspaceShorthand",
    params: { projectId, ticketShorthand, workspaceShorthand },
  });
};
