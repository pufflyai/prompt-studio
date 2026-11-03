import { normalizeMessageResults } from "pstdio-api-contracts";
import type { SessionLogFiles } from "./log-files";
import { sessionLogVersion } from "./log-publication";
import type { PersonalHistoryStore } from "./store";

/** Message reads retain identity; completion also retains its terminal version. */
export const createPersonalMessageReader = (input: {
  context: (projectId: string) => Promise<{
    identity: string | undefined;
    namespace: string;
    history: PersonalHistoryStore;
  } | null>;
  sessions: (projectId: string) => Promise<{ id: string; status: string; updated_at?: string | null }[]>;
  logs: SessionLogFiles;
  refreshIdentity: () => Promise<unknown>;
  identity: () => string | undefined;
}) => ({
  async messagesReady(id: string, projectId: string, version: string) {
    const current = await input.context(projectId);
    if (!current) return false;
    const matches = async () => {
      const session = (await input.sessions(projectId)).find((row) => row.id === id);
      return session !== undefined && sessionLogVersion(session) === version;
    };
    if (!(await matches())) return false;
    const publication = await current.history.readPublication(id);
    if (publication?.version !== version) return false;
    const position = await input.logs.readPosition(current.namespace, id);
    // A resumed run can finish while the disk read is pending. Its older proof must not end this stream.
    const latest = await current.history.readPublication(id);
    const sameSession = await matches();
    await input.refreshIdentity();
    return (
      current.identity === input.identity() &&
      sameSession &&
      latest?.version === version &&
      latest.head === publication.head &&
      position.after >= latest.head
    );
  },
  async messages(id: string, projectId: string) {
    const current = await input.context(projectId);
    if (!current || !(await input.sessions(projectId)).some((row) => row.id === id)) return null;
    const messages = await input.logs.read(current.namespace, id);
    await input.refreshIdentity();
    return current.identity === input.identity() ? messages?.map(normalizeMessageResults) : null;
  },
});
