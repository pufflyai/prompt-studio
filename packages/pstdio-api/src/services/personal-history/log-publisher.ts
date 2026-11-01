import { createHash } from "node:crypto";
import type { SessionMessage } from "pstdio-api-contracts";
import type { SyncSpace } from "pstdio-sync";
import type { DocumentRelay } from "pstdio-sync/relay";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { getSessionHistory } from "../../features/sessions/session-history";
import { createLivePublisher } from "./live-messages";
import { batchLines, messageEntries } from "./log-entries";
import type { SessionLogFiles } from "./log-files";
import { publishLogUpdate } from "./log-updates";

export const sessionLogName = (sessionId: string) => JSON.stringify(["pstdio.personal-history", "log", sessionId]);

// A saved conversation can list a message's keys in another order or omit undefined fields, so the fingerprint
// uses canonical JSON of the plain value.
const fingerprint = (message: SessionMessage) =>
  createHash("sha256")
    .update(canonicalJson(JSON.parse(JSON.stringify(message)) as Json))
    .digest("base64url")
    .slice(0, 22);

const changedEntries = (
  messages: SessionMessage[],
  fingerprints: string[],
  compared: WeakMap<SessionMessage, string>,
) => {
  const lines: string[] = [];
  const next = [...fingerprints];
  for (const [index, message] of messages.entries()) {
    const value = compared.get(message) ?? fingerprint(message);
    compared.set(message, value);
    if (next[index] === value) continue;
    next[index] = value;
    lines.push(...messageEntries(index, message));
  }
  return { lines, next };
};

/**
 * Publishes this device's sessions: completed messages to each session's relay log, and the message that is
 * still streaming over the live channel, which stores nothing.
 */
export const createLogPublisher = (input: {
  files: SessionLogFiles;
  namespace: string;
  deviceId: string;
  deps: Pick<
    ExtensionsRouteDeps,
    "sessionService" | "fileService" | "harnessRegistry" | "workspaceSessionService" | "personalHistoryService"
  >;
  /** Reports a log's relay position. It is also saved with the publish, so a restart reports it again. */
  published: (sessionId: string, head: number) => void;
}) => {
  const { files, namespace, deps } = input;
  // The message objects last compared. A live conversation keeps unchanged messages as the same objects.
  const compared = new WeakMap<SessionMessage, string>();
  const published = new Map<string, { updatedAt: string | null; fingerprints: string[]; head?: number }>();
  const live = createLivePublisher({ deviceId: input.deviceId, sessions: deps.sessionService.store });

  const reportHead = (sessionId: string, head?: number) => {
    if (head) input.published(sessionId, head);
  };

  const publishOne = async (
    sessionId: string,
    space: SyncSpace,
    relay: (documentId: string) => DocumentRelay,
    skipUnchanged: boolean,
  ) => {
    const session = await deps.sessionService.get(sessionId);
    if (!session) return;
    const saved = published.get(sessionId) ?? (await files.readPublished(namespace, sessionId));
    // Saving a conversation changes `updated_at`, so an equal value means nothing new to load.
    if (skipUnchanged && saved.updatedAt === session.updated_at) {
      reportHead(sessionId, saved.head);
      return false;
    }
    const messages = await getSessionHistory(sessionId, deps);
    if (session.status !== "in_progress") live.finish(sessionId);
    const complete = session.status === "in_progress" ? Math.max(0, messages.length - 1) : messages.length;
    const { lines, next } = changedEntries(messages.slice(0, complete), saved.fingerprints, compared);
    let head: number | undefined;
    if (lines.length) {
      const documentId = await space.documentId(sessionLogName(sessionId));
      const target = relay(documentId);
      for (const batch of batchLines(lines)) head = (await publishLogUpdate(space, documentId, target, batch)).sequence;
    }
    const record = { updatedAt: session.updated_at, fingerprints: next, head: head ?? saved.head };
    reportHead(sessionId, record.head);
    await files.writePublished(namespace, sessionId, record);
    published.set(sessionId, record);
  };

  return {
    /**
     * Publishes the messages of these sessions that are complete and not published yet. With `skipUnchanged`,
     * a session whose saved conversation did not change since its last publish is not loaded at all.
     */
    async publish(
      sessionIds: Iterable<string>,
      space: SyncSpace,
      relay: (documentId: string) => DocumentRelay,
      options: { skipUnchanged?: boolean } = {},
    ) {
      for (const sessionId of sessionIds) await publishOne(sessionId, space, relay, options.skipUnchanged ?? false);
    },
    live: live.live,
    close: live.close,
  };
};
