import type { SessionMessage } from "pstdio-api-contracts";
import type { SyncSpace } from "pstdio-sync";
import type { DocumentRelay } from "pstdio-sync/relay";
import { createLineReader } from "./log-entries";
import type { SessionLogFiles } from "./log-files";
import { sessionLogName } from "./log-publisher";
import { readLogUpdate } from "./log-updates";

/**
 * Copies other devices' session logs to this device. Each read starts at the saved relay position and goes
 * page by page, so memory follows the new entries, not the size of the conversation.
 */
export const createLogReceiver = (input: {
  files: SessionLogFiles;
  namespace: string;
  received: (sessionId: string, index: number, message: SessionMessage) => void;
}) => {
  const { files, namespace } = input;
  const documentIds = new Map<string, string>();
  // Read positions and the heads last compared, kept in memory so a check costs only the heads that moved.
  const positions = new Map<string, number>();
  const compared = new Map<string, number>();
  const position = async (sessionId: string) => {
    let after = positions.get(sessionId);
    if (after === undefined) {
      after = (await files.readPosition(namespace, sessionId)).after;
      positions.set(sessionId, after);
    }
    return after;
  };
  const readers = new Map<string, ReturnType<typeof createLineReader>>();
  const documentId = async (space: SyncSpace, sessionId: string) => {
    let id = documentIds.get(sessionId);
    if (!id) {
      id = await space.documentId(sessionLogName(sessionId));
      documentIds.set(sessionId, id);
    }
    return id;
  };

  // Saves one page of new entries and reports each completed message.
  const savePage = async (sessionId: string, lines: string[], after: number) => {
    if (!lines.length) return;
    await files.savePage(namespace, sessionId, after, lines);
    positions.set(sessionId, after);
    const read = readers.get(sessionId) ?? createLineReader();
    readers.set(sessionId, read);
    for (const line of lines) {
      const entry = read(line);
      if (entry) input.received(sessionId, entry.index, entry.message);
    }
  };

  const readOne = async (sessionId: string, space: SyncSpace, relay: (documentId: string) => DocumentRelay) => {
    const id = await documentId(space, sessionId);
    const source = relay(id);
    let after = await position(sessionId);
    while (true) {
      const result = await source.read(after);
      // Logs never publish a latest state, so the relay keeps every entry.
      if (result.status === "state-required") throw new Error("Relay removed session log entries");
      for (const update of result.updates.filter((update) => update.sequence > after)) {
        const lines = await readLogUpdate(space, id, source, update);
        await savePage(sessionId, lines, update.sequence);
        after = update.sequence;
      }
      if (!result.more) return;
    }
  };

  return {
    /** Sessions whose published log is ahead of what this device has read. */
    async behind(sessionIds: string[], heads: Map<string, number>) {
      const found: string[] = [];
      for (const sessionId of sessionIds) {
        const head = heads.get(sessionId);
        if (!head || compared.get(sessionId) === head) continue;
        if ((await position(sessionId)) < head) found.push(sessionId);
        else compared.set(sessionId, head);
      }
      return found;
    },
    /** Sessions among `candidates` whose log the relay reported as changed. */
    async changed(documentIds: Set<string>, candidates: string[], space: SyncSpace) {
      const found: string[] = [];
      for (const sessionId of candidates)
        if (documentIds.has(await documentId(space, sessionId))) found.push(sessionId);
      return found;
    },
    async read(sessionIds: Iterable<string>, space: SyncSpace, relay: (documentId: string) => DocumentRelay) {
      for (const sessionId of sessionIds) await readOne(sessionId, space, relay);
    },
  };
};
