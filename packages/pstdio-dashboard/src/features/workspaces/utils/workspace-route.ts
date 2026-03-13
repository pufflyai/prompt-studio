export const isWorkspaceRoutePath = (pathname: string, projectId: string | undefined) => {
  if (!projectId) return false;

  const projectTicketsPrefix = `/projects/${projectId}/tickets/`;
  if (!pathname.startsWith(projectTicketsPrefix)) return false;

  const routeParts = pathname.slice(projectTicketsPrefix.length).split("/");
  const [ticketShorthand, workspacesSegment, workspaceShorthand] = routeParts;

  return Boolean(ticketShorthand) && workspacesSegment === "workspaces" && Boolean(workspaceShorthand);
};
