import type { SessionMessage } from "pstdio-api-contracts";
import type { SyncSpace } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { StorageLogEntry } from "pstdio-sync-contracts";
import { createLineReader } from "./log-entries";
import type { SessionLogFiles } from "./log-files";
import { sessionLogName } from "./log-publisher";
import type { PersonalLogStreams } from "./log-stream";

const personalLogLines = (entries: StorageLogEntry[]) =>
  entries.flatMap((entry) => {
    const value = entry.value as { lines?: unknown };
    if (!value || !Array.isArray(value.lines) || value.lines.some((line) => typeof line !== "string"))
      throw new Error("Invalid personal log lines");
    return value.lines as string[];
  });

import { readLogUpdate } from "./log-updates";

/**
 * Copies other devices' session logs to this device. Each read starts at the saved relay position and goes
 * page by page, so memory follows the new entries, not the size of the conversation.
 */
export const createLogReceiver = (input: {
  files: SessionLogFiles;
  namespace: string;
  streams?: PersonalLogStreams;
  source?: (id: string) => Promise<{ writerId?: string; format?: "append-log-v1" }>;
  received: (sessionId: string, index: number, message: SessionMessage) => void;
}) => {
  const { files, namespace } = input;
  const documentIds = new Map<string, string>();
  // Read positions and the heads last compared, kept in memory so a check costs only the heads that moved.
  const positions = new Map<string, number>();
  const compared = new Map<string, string>();
  const position = async (sessionId: string) => {
    const source = await input.source?.(sessionId);
    const key = `${sessionId}:${source?.format ?? "legacy"}`;
    let after = positions.get(key);
    if (after === undefined) {
      after = (await files.readPosition(namespace, sessionId, source?.format)).after;
      positions.set(key, after);
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

  const emitLines = (sessionId: string, lines: string[]) => {
    const read = readers.get(sessionId) ?? createLineReader();
    readers.set(sessionId, read);
    for (const line of lines) {
      const entry = read(line);
      if (entry) input.received(sessionId, entry.index, entry.message);
    }
  };
  // Saves one page of new entries and reports each completed message.
  const savePage = async (sessionId: string, lines: string[], after: number) => {
    if (!lines.length) return;
    await files.savePage(namespace, sessionId, after, lines);
    positions.set(`${sessionId}:legacy`, after);
    emitLines(sessionId, lines);
  };

  const readLegacy = async (sessionId: string, space: SyncSpace, relay: (documentId: string) => DocumentRelay) => {
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
  const readOne = async (sessionId: string, space: SyncSpace, relay: (id: string) => DocumentRelay) => {
    const source = await input.source?.(sessionId);
    if (!source?.format) return readLegacy(sessionId, space, relay);
    if (!source.writerId || !input.streams) throw new Error("Personal generic log source unavailable");
    const stream = await input.streams.open(sessionId, source.writerId, space, relay);
    let saved = await files.readGenericPosition(namespace, sessionId);
    while (true) {
      const page = await stream.sync.read({ after: saved.cursor || 0, limit: 1 });
      const lines = personalLogLines(page.entries);
      const head = page.more ? saved.head : (await stream.store.status()).head;
      if (lines.length || page.cursor !== saved.cursor || head !== saved.head)
        await files.saveGenericPage(namespace, sessionId, { lines, head, cursor: page.cursor });
      saved = { ...saved, head, cursor: page.cursor };
      positions.set(`${sessionId}:append-log-v1`, head);
      emitLines(sessionId, lines);
      if (!page.more) return;
    }
  };

  return {
    /** Sessions whose published log is ahead of what this device has read. */
    async behind(sessionIds: string[], heads: Map<string, number>) {
      const found: string[] = [];
      for (const sessionId of sessionIds) {
        const head = heads.get(sessionId);
        const source = await input.source?.(sessionId);
        const proof = `${source?.format ?? "legacy"}:${head}`;
        if (!head || compared.get(sessionId) === proof) continue;
        if ((await position(sessionId)) < head) found.push(sessionId);
        else compared.set(sessionId, proof);
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
