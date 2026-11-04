import { createHash } from "node:crypto";
import type { SessionMessage } from "pstdio-api-contracts";
import type { SyncSpace } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { getSessionHistory } from "../../features/sessions/session-history";
import { createLivePublisher } from "./live-messages";
import { batchLines, messageEntries } from "./log-entries";
import type { SessionLogFiles } from "./log-files";
import { sessionLogVersion } from "./log-publication";
import type { PersonalLogStreams } from "./log-stream";

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
  streams: PersonalLogStreams;
  deps: Pick<
    ExtensionsRouteDeps,
    "sessionService" | "fileService" | "harnessRegistry" | "workspaceSessionService" | "personalHistoryService"
  >;
  /** Reports a log's relay position. It is also saved with the publish, so a restart reports it again. */
  published: (sessionId: string, head: number, completedVersion?: string, format?: "append-log-v1") => void;
}) => {
  const { files, namespace, deps } = input;
  // The message objects last compared. A live conversation keeps unchanged messages as the same objects.
  const compared = new WeakMap<SessionMessage, string>();
  const published = new Map<string, Awaited<ReturnType<SessionLogFiles["readPublished"]>>>();
  const live = createLivePublisher({ deviceId: input.deviceId, sessions: deps.sessionService.store });

  const reportHead = (
    sessionId: string,
    session: Parameters<typeof sessionLogVersion>[0],
    head = 0,
    format?: "append-log-v1",
  ) => {
    const version = session.status === "in_progress" ? undefined : sessionLogVersion(session);
    if (head || version) input.published(sessionId, head, version, format);
  };

  const publishLines = async (
    sessionId: string,
    space: SyncSpace,
    relay: (id: string) => DocumentRelay,
    lines: string[],
    saved: Awaited<ReturnType<SessionLogFiles["readPublished"]>>,
  ) => {
    const stream = await input.streams.open(sessionId, await input.streams.writerId(), space, relay);
    const digest = createHash("sha256").update(lines.join("\n")).digest("hex");
    const pending =
      saved.pending?.fingerprint === digest ? saved.pending : { fingerprint: digest, id: crypto.randomUUID() };
    // The identity is durable before any append/upload, including a lost response on the final batch.
    await files.writePublished(namespace, sessionId, { ...saved, pending });
    published.set(sessionId, { ...saved, pending });
    let index = 0;
    for (const batch of batchLines(lines))
      await stream.store.append({ lines: batch }, { id: `${pending.id}:${index++}` });
    await stream.sync.publish();
    return (await stream.store.status()).head;
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
    // A status transition can share the previous timestamp and make the final message durable.
    if (skipUnchanged && !saved.pending && saved.status === session.status && saved.updatedAt === session.updated_at) {
      reportHead(sessionId, session, saved.head, saved.format);
      return false;
    }
    const messages = await getSessionHistory(sessionId, deps);
    if (session.status !== "in_progress") live.finish(sessionId);
    const complete = session.status === "in_progress" ? Math.max(0, messages.length - 1) : messages.length;
    const { lines, next } = changedEntries(
      messages.slice(0, complete),
      saved.format ? saved.fingerprints : [],
      compared,
    );
    let head = saved.format ? saved.head : 0;
    if (lines.length) head = await publishLines(sessionId, space, relay, lines, saved);
    const record = {
      updatedAt: session.updated_at,
      status: session.status,
      fingerprints: next,
      head,
      format: "append-log-v1" as const,
    };
    reportHead(sessionId, session, record.head, record.format);
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
    prepare: live.prepare,
    live: live.live,
    close: live.close,
  };
};
