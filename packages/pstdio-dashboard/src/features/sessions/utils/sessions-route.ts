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

interface SessionBubbleReturnPathInput {
  projectId: string | undefined;
  lastNonSessionsPath: string | null;
}

const getProjectRootPath = (projectId: string | undefined) => {
  if (!projectId) return "/projects";
  return `/projects/${projectId}`;
};

export const getSessionBubbleReturnPath = (input: SessionBubbleReturnPathInput) => {
  const { projectId, lastNonSessionsPath } = input;
  const projectRootPath = getProjectRootPath(projectId);
  if (!projectId || !lastNonSessionsPath) return projectRootPath;

  const pathname = lastNonSessionsPath.split(/[?#]/, 1)[0] ?? "";
  const isCurrentProjectPath = pathname === projectRootPath || pathname.startsWith(`${projectRootPath}/`);

  if (!isCurrentProjectPath || isSessionsRoutePath(pathname, projectId)) {
    return projectRootPath;
  }

  return lastNonSessionsPath;
};
