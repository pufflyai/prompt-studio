export const isSessionsRoutePath = (pathname: string, projectId: string | undefined) => {
  if (!projectId) return false;

  const projectSessionsPath = `/projects/${projectId}/sessions`;
  return pathname === projectSessionsPath || pathname.startsWith(`${projectSessionsPath}/`);
};
