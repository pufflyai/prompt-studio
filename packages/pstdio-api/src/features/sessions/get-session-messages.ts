import { readFileSync } from "node:fs";
import type { AgentId, SessionMessage } from "pstdio-agents";
import type { RouteDeps } from "../deps";
import { toAgentId } from "../harnesses/harness-ids";
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
    const agentMessages = await getProviderMessages(
      session.agent,
      session.agent_session_id,
      session.cwd,
      session.project_id,
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

const getProviderMessages = async (
  agentId: string,
  agentSessionId: string,
  cwd: string | null,
  projectId: string | null,
  deps: RouteDeps,
) => {
  const resolved = await deps.harnessProviderService.resolve(agentId, projectId ?? undefined);
  if (resolved?.provider.getMessages) {
    const messages = (await resolved.provider.getMessages(
      resolved.context,
      agentSessionId,
      cwd ? { cwd } : undefined,
    )) as SessionMessage[];
    if (messages.length > 0) return messages;

    return (await getLegacyAgentMessages(agentId, agentSessionId, cwd, deps)) ?? messages;
  }

  return getLegacyAgentMessages(agentId, agentSessionId, cwd, deps);
};

const getLegacyAgentMessages = async (agentId: string, agentSessionId: string, cwd: string | null, deps: RouteDeps) => {
  const agent = deps.agentRegistry.get(toAgentId(agentId) as AgentId);
  if (!agent) return null;

  return agent.getMessages(agentSessionId, cwd ? { cwd } : undefined);
};
