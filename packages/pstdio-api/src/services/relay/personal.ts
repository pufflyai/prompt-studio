import { createDocumentRelayConnection, createLiveConnection, type LiveConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createLogProgress, personalHistoryProgress } from "../personal-history/log-progress";
import { createPersonalAnnouncements } from "./personal-announcements";
import { createPersonalContext, createPersonalReaders, personalLiveReceiver } from "./personal-context";
import { createPersonalDocuments } from "./personal-documents";
import { createPersonalIndex } from "./personal-index";
import { createPersonalLive } from "./personal-live";
import { createPersonalPreviews } from "./personal-previews";
import { createPersonalPublication } from "./personal-publication";
import { watchPersonalHistory } from "./personal-watches";
import type { RelayWorkbench } from "./runtime";

const personalSyncFailed = (workbenchId: string) =>
  apiLogger.warn({ event: "relay.personal.reconnecting", workbenchId }, "Personal history sync will retry");

/**
 * Publishes this device's session history to the user's private space and copies the user's other devices'
 * history here. Each device publishes index changes as an append-only log. Each conversation is a log of
 * completed messages, and streaming text goes over the live channel, which stores nothing.
 */
interface RelayPersonalInput {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  live?: LiveConnection;
  statusChanged?: () => void;
}

const personalConnection = (input: RelayPersonalInput, signal: AbortSignal) =>
  input.live ??
  createLiveConnection({
    origin: input.config.relayOrigin,
    projectId: input.config.workbenchId,
    access: input.access,
    signal,
  });

export const startRelayPersonalHistory = (input: RelayPersonalInput) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const live = personalConnection(input, signal);
  const context = createPersonalContext(config, deps);
  const { history, namespace } = context;
  const documents = createPersonalDocuments({
    config,
    context,
    signal,
    access: input.access,
    subscribe: (spaceOwner, id) => connection.subscribe(spaceOwner, id),
  });
  const logs = deps.personalHistoryService.logs;
  const progress = createLogProgress();
  const publishingSessions = new Set<string>();
  let firstDownloaded = false;
  const publisher = createPersonalPublication({
    files: logs,
    namespace,
    deviceId: config.environmentId,
    deps,
    interested: (id) => channel.watching(id),
    published: (sessionId) => publishingSessions.delete(sessionId),
    failed: (id) => {
      changedSessions.add(id);
      connection.retry();
    },
    wake: () => connection.wake(),
    statusChanged: input.statusChanged,
    history,
    documents,
  });
  const { liveReceiver, readLogs, catchUp, requestLog } = createPersonalReaders(
    deps,
    logs,
    namespace,
    config.environmentId,
  );

  // Sync state lasts as long as the key generation. An access renewal keeps it; only a lost connection makes the
  // next run check everything again.
  // Publishing everything is needed once per process: changes made before it started were never tracked.
  // Reading everything is needed after a lost connection: the relay's change notices were missed.
  let publishAll = true;
  let readAll = true;
  // The index changed here (session or workspace rows), or the relay reported another device's change.
  let localIndexChanged = true;
  let remoteIndexChanged = true;
  let lastRun = 0;
  const index = createPersonalIndex({ deps, config, context });
  const changedSessions = new Set<string>();

  const previews = createPersonalPreviews({
    owned: () => index.owned,
    space: () => documents.space,
    sessions: deps.sessionService.store,
    publish: (id, space) => publisher.live(id, space, channel.send),
    wake: () => connection.wake(),
  });
  const announcements = createPersonalAnnouncements(deps, config.workbenchId, signal);
  const prepare = async (attemptSignal: AbortSignal) => {
    const prepared = await documents.prepare(attemptSignal);
    await channel.prepare(prepared.personal, index.streaming);
    publisher.prepare(prepared.personal, channel.send);
    if (prepared.renewed || prepared.recreated) {
      liveReceiver.reset();
      readAll = true;
      remoteIndexChanged = true;
      progress.invalidate();
    }
    publishAll ||= prepared.recreated;
    return prepared;
  };
  const interrupted = (publishing: { all: boolean; read: boolean }, own: string[]) => {
    publishAll ||= publishing.all;
    readAll ||= publishing.read;
    for (const id of own) changedSessions.add(id);
    localIndexChanged = true;
    index.invalidate();
    remoteIndexChanged = true;
  };
  const connection = createDocumentRelayConnection({
    live,
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access: input.access,
    signal,
    acceptsChange: (change) => documents.owns(change.documentId),
    onReady: documents.invalidateKeys,
    onDisconnect: (reason) => {
      if (reason === "offline") documents.invalidateIndexes();
    },
    onStatusChange: () => {
      if (!connection.status().connected) {
        readAll = true;
        liveReceiver.reset();
      }
      input.statusChanged?.();
    },
    synchronize: async (attemptSignal) => {
      const wait = lastRun + 1000 - Date.now();
      if (wait > 0 && !readAll) await Bun.sleep(wait);
      lastRun = Date.now();
      const { personal } = await prepare(attemptSignal);
      const full = publishAll || readAll;
      const publishing = { all: publishAll, read: readAll };
      publishAll = false;
      readAll = false;
      const own = [...changedSessions];
      changedSessions.clear();
      try {
        const captured = full || localIndexChanged;
        if (captured) {
          localIndexChanged = false;
          const previous = await index.capture(full);
          await channel.prepare(personal, index.streaming);
          previews.admitted(previous);
        }
        attemptSignal.throwIfAborted();
        const sessions = publishing.all ? [...index.owned] : own.filter((id) => index.owned.has(id));
        for (const id of sessions) publishingSessions.add(id);
        await publisher.publish(sessions, personal, documents.relayFor(personal), { skipUnchanged: publishing.all });
        attemptSignal.throwIfAborted();
        previews.flush();
        const remote = remoteIndexChanged;
        remoteIndexChanged = false;
        const indexSynced = await publisher.synchronizeIndex(full, captured, remote);
        attemptSignal.throwIfAborted();
        if (publishing.read || indexSynced || captured)
          await readLogs(personal, documents.relayFor(personal), history, index.owned, progress, input.statusChanged);
        if (indexSynced) await announcements.announce();
        firstDownloaded ||= progress.status(new Set()).downloaded && (await documents.status()).downloaded;
      } catch (error) {
        interrupted(publishing, own);
        throw error;
      } finally {
        publishingSessions.clear();
        input.statusChanged?.();
      }
    },
    onError: () => personalSyncFailed(config.workbenchId),
  });
  const channel = createPersonalLive({
    live,
    ready: previews.ready,
    history: {
      readingSessions: () => deps.personalHistoryService.readingSessions(config.workbenchId),
      watchReaders: deps.personalHistoryService.watchReaders,
    },
    watchingChanged: (id, active) => publisher.watch(id, active, channel.send),
    logChanged: (id) => {
      requestLog(id);
      if (!documents.space) return;
      void catchUp(id, documents.space, documents.relayFor(documents.space)).catch(() => {
        readAll = true;
        connection.retry();
      });
    },
    received: personalLiveReceiver(liveReceiver, () => documents.space),
    owns: documents.owns,
    changed: (id) => {
      documents.changed(id);
      remoteIndexChanged = true;
      progress.invalidate();
      input.statusChanged?.();
      connection.wake();
    },
  });
  const stopWatching = watchPersonalHistory({
    deps,
    owner: history.owner,
    announcing: () => announcements.state.announcing,
    ownsSession: (id) => index.owned.has(id),
    preview: previews.changed,
    indexChanged: (id) => {
      if (id) {
        changedSessions.add(id);
        index.changed(id);
      } else index.changed();
      localIndexChanged = true;
      progress.invalidate();
      input.statusChanged?.();
      connection.wake();
    },
    conversationChanged: (id) => {
      changedSessions.add(id);
      input.statusChanged?.();
      connection.wake();
    },
    statusChanged: input.statusChanged,
  });
  return {
    retry: connection.retry,
    async status() {
      const indexStatus = await documents.status(publisher.hasPendingHeads());
      const pending = new Set([...changedSessions, ...publishingSessions].filter((id) => index.owned.has(id)));
      const logs = progress.status(pending);
      return personalHistoryProgress(indexStatus, logs, firstDownloaded, connection.status());
    },
    done: connection.done.finally(async () => {
      await stopWatching();
      channel.close();
      documents.close();
      publisher.close();
      liveReceiver.close();
    }),
    close() {
      void stopWatching();
      controller.abort();
      channel.close();
      if (!input.live) live.close();
      announcements.clear();
    },
  };
};
