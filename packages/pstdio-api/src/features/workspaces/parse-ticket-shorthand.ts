/** Extracts ticket shorthand from a workspace shorthand (e.g. "PS-1_A3" → "PS-1"). */
export const parseTicketShorthand = (workspaceShorthand: string) => {
  const match = workspaceShorthand.match(/^(.+)_A\d+$/);
  return match?.[1] ?? undefined;
};
