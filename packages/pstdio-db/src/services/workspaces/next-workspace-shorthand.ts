export const nextWorkspaceShorthand = (ticketShorthand: string, existingCount: number) =>
  `${ticketShorthand}_A${existingCount + 1}`;
