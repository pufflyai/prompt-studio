import { createReadBoundary, type InvocationScope } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "../deps";

export interface SessionApiScope {
  projectId: string;
  signal?: AbortSignal;
  scope?: InvocationScope;
}

export const createSessionAccess = (deps: ExtensionsRouteDeps, input: SessionApiScope) => {
  const read = createReadBoundary(input.signal);
  const getProjectSession = async (id: string) => {
    const session = await deps.sessionService.get(id);
    return session?.project_id === input.projectId ? session : null;
  };
  const requireProjectSession = async (id: string) => {
    const session = await getProjectSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    return session;
  };
  const requireReadableSession = async (id: string) => {
    const session =
      (await read(() => getProjectSession(id))) ??
      (await read(() => deps.personalHistoryService.getSession(id, input.projectId)));
    if (!session) throw new Error(`Session not found: ${id}`);
    return session;
  };
  return { read, getProjectSession, requireProjectSession, requireReadableSession };
};
