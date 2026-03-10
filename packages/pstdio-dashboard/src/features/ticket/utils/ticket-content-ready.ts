export const isTicketContentReady = (content: string | undefined, isLoading: boolean) => {
  if (isLoading) return false;
  return content !== undefined;
};
