export const nextWorkspaceShorthand = (ticketShorthand: string, existingCount: number) =>
  `${ticketShorthand}/A${existingCount + 1}`;
