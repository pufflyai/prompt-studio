export const getSessionsRoutePath = (projectId: string | undefined, sessionId: string | null) => {
  if (!projectId) return null;

  const basePath = `/projects/${projectId}/sessions`;
  if (!sessionId) return basePath;

  return `${basePath}/${sessionId}`;
};

export const isSessionsRoutePath = (pathname: string, projectId: string | undefined) => {
  if (!projectId) return false;

  const projectSessionsPath = `/projects/${projectId}/sessions`;
  return pathname === projectSessionsPath || pathname.startsWith(`${projectSessionsPath}/`);
};
