import { readFileSync } from "node:fs";
import type { AgentId, SessionMessage } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { resolveSessionCwd } from "./resolve-session-cwd";
import { buildMessagesFromPatches } from "./session-messages";

export const getSessionMessages = async (sessionId: string, deps: RouteDeps): Promise<SessionMessage[]> => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return [];

  const persistedMessages = session.session_file_id ? await getPersistedMessages(session.session_file_id, deps) : [];
  const entry = deps.sessionService.store.get(sessionId);

  if (entry) {
    return buildMessagesFromPatches(entry.eventStore.getHistory(), persistedMessages);
  }

  if (session.agent && session.agent_session_id && session.project_id) {
    const agentMessages = await getAgentMessages(
      session.agent,
      session.agent_session_id,
      session.project_id,
      session.id,
      deps,
    ).catch(() => null);
    return agentMessages ?? persistedMessages;
  }

  return persistedMessages;
};

const getPersistedMessages = async (sessionFileId: string, deps: RouteDeps) => {
  const file = await deps.fileService.get(sessionFileId);
  if (!file) return [];

  return JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
};

const getAgentMessages = async (
  agentId: string,
  agentSessionId: string,
  projectId: string,
  sessionId: string,
  deps: RouteDeps,
) => {
  const agent = deps.agentRegistry.get(agentId as AgentId);
  if (!agent) return null;

  const workspace = await deps.workspaceSessionService.getWorkspaceBySessionId(sessionId);
  const cwd = await resolveSessionCwd(deps, projectId, workspace?.id);
  return agent.getMessages(agentSessionId, cwd ? { cwd } : undefined);
};
