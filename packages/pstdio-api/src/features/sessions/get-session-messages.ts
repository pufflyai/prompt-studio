import { readFileSync } from "node:fs";
import type { AgentId, SessionMessage } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { buildMessagesFromPatches } from "./session-messages";

export const getSessionMessages = async (sessionId: string, deps: RouteDeps): Promise<SessionMessage[]> => {
  const session = await deps.sessionService.get(sessionId);
  if (!session) return [];

  const persistedMessages = session.session_file_id ? await getPersistedMessages(session.session_file_id, deps) : [];
  const entry = deps.sessionService.store.get(sessionId);

  if (entry) {
    return buildMessagesFromPatches(entry.eventStore.getHistory(), persistedMessages);
  }

  if (session.agent && session.agent_session_id) {
    const agentMessages = await getAgentMessages(session.agent, session.agent_session_id, session.cwd, deps).catch(
      () => null,
    );
    return agentMessages ?? persistedMessages;
  }

  return persistedMessages;
};

const getPersistedMessages = async (sessionFileId: string, deps: RouteDeps) => {
  const file = await deps.fileService.get(sessionFileId);
  if (!file) return [];

  return JSON.parse(readFileSync(file.storage_path, "utf-8")) as SessionMessage[];
};

const getAgentMessages = async (agentId: string, agentSessionId: string, cwd: string | null, deps: RouteDeps) => {
  const agent = deps.agentRegistry.get(agentId as AgentId);
  if (!agent) return null;

  return agent.getMessages(agentSessionId, cwd ? { cwd } : undefined);
};
