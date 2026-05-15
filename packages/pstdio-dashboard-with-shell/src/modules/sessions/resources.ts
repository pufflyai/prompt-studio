import type { ResourceRef } from "pstdio-shell/core";
import { SESSION_ICON, SESSION_RESOURCE_KIND, SESSIONS_ICON, SESSIONS_RESOURCE_KIND } from "./constants";

const PROJECT_SESSIONS_PATTERN = /^(?:pstdio:\/\/projects\/|#projects\/)([^/]+)\/sessions$/;
const PROJECT_SESSION_PATTERN = /^(?:pstdio:\/\/projects\/|#projects\/)([^/]+)\/sessions\/([^/]+)$/;

const readProjectId = (resource: ResourceRef) =>
  typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : null;

export const createSessionsResource = (projectId: string): ResourceRef => ({
  kind: SESSIONS_RESOURCE_KIND,
  uri: `pstdio://projects/${projectId}/sessions`,
  id: projectId,
  label: "Sessions",
  icon: SESSIONS_ICON,
  metadata: { projectId },
});

export const createSessionResource = (projectId: string, sessionId: string, label?: string): ResourceRef => ({
  kind: SESSION_RESOURCE_KIND,
  uri: `pstdio://projects/${projectId}/sessions/${sessionId}`,
  id: sessionId,
  label: label ?? "Session",
  icon: SESSION_ICON,
  metadata: { projectId },
});

export const parseSessionsLocation = (location: string) => {
  const detail = location.match(PROJECT_SESSION_PATTERN);
  if (detail?.[1] && detail[2]) return createSessionResource(detail[1], detail[2]);

  const root = location.match(PROJECT_SESSIONS_PATTERN);
  if (root?.[1]) return createSessionsResource(root[1]);

  return null;
};

export const createSessionsHref = (resource: ResourceRef) => {
  const projectId = readProjectId(resource);
  if (!projectId) return "";

  if (resource.kind === SESSION_RESOURCE_KIND && resource.id) {
    return `#projects/${projectId}/sessions/${resource.id}`;
  }

  return `#projects/${projectId}/sessions`;
};

export const isSessionsResource = (resource: ResourceRef) =>
  resource.kind === SESSIONS_RESOURCE_KIND || resource.kind === SESSION_RESOURCE_KIND;

export const getProjectIdFromResource = readProjectId;
