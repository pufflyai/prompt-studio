/** @deprecated Legacy ticket-workspace shorthand parsing. Ticket ownership is moving to the pstdio tickets extension. */
export const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};
