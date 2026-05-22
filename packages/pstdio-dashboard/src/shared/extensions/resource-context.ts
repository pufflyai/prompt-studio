interface TicketResourceInput {
  projectId: string | undefined;
  ticket: {
    id: string;
    shorthand: string;
    title?: string | null;
  };
}

interface WorkspaceResourceInput {
  projectId: string | undefined;
  ticket: {
    id: string;
    shorthand: string;
  };
  workspace: {
    id: string;
    shorthand: string;
  };
}

export const buildTicketExtensionResource = (input: TicketResourceInput) => {
  const { projectId, ticket } = input;
  if (!projectId) return undefined;

  return {
    type: "ticket",
    id: ticket.id,
    label: ticket.shorthand,
    projectId,
    metadata: { shorthand: ticket.shorthand, title: ticket.title },
  };
};

export const buildWorkspaceExtensionResource = (input: WorkspaceResourceInput) => {
  const { projectId, ticket, workspace } = input;
  if (!projectId) return undefined;

  return {
    type: "workspace",
    id: workspace.id,
    label: workspace.shorthand,
    projectId,
    metadata: {
      ticket: ticket.shorthand,
      ticketId: ticket.id,
      workspaceShorthand: workspace.shorthand,
    },
  };
};
