import { createDocumentRelayConnection, createLiveConnection } from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import { personalHistoryProgress } from "../personal-history/log-progress";
import { createPersonalAnnouncements } from "./personal-announcements";
import { personalLiveReceiver } from "./personal-context";
import { createPersonalIndex } from "./personal-index";
import { createPersonalLive } from "./personal-live";
import { createPersonalPreviews } from "./personal-previews";
import { createPersonalSource, type RelayPersonalInput } from "./personal-source";
import { watchPersonalHistory } from "./personal-watches";
import { createSourceActivity } from "./source-activity";

const personalSyncFailed = (workbenchId: string) =>
  apiLogger.warn({ event: "relay.personal.reconnecting", workbenchId }, "Personal history sync will retry");
// Coalesce local publication without delaying subscription or remote-only catch-up.
const waitForPersonalRun = async (lastRun: number, readAll: boolean, publishing: boolean) => {
  if (!publishing) return lastRun;
  const wait = lastRun + 1000 - Date.now();
  if (wait > 0 && !readAll) await Bun.sleep(wait);
  return Date.now();
};

const closePersonalResources = (resources: { close(): unknown }[]) => {
  for (const resource of resources) resource.close();
};

/**
 * Publishes this device's session history to the user's private space and copies the user's other devices'
 * history here. Each device publishes index changes as an append-only log. Each conversation is a log of
 * completed messages, and streaming text goes over the live channel, which stores nothing.
 */

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
  const activity = createSourceActivity(input.statusChanged);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const live = personalConnection(input, signal);
  const { context, documents, publishingSessions, publisher, progress, readers } = createPersonalSource({
    ...input,
    signal,
    activity,
    subscribe: (spaceOwner, id) => connection.subscribe(spaceOwner, id),
    interested: (id) => channel.watching(id),
    failed: (id) => {
      changedSessions.add(id);
      connection.retry();
    },
    wake: () => connection.wake(),
    admit: (work) => connection.admit(work),
  });
  const { history } = context;
  let firstDownloaded = false;
  const { liveReceiver, readLogs, catchUp, requestLog } = readers;

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
    const prepared = await activity.run("loading-keys", () => documents.prepare(attemptSignal), attemptSignal);
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
      activity.start();
      const { personal } = await prepare(attemptSignal);
      const full = publishAll || readAll;
      const captured = full || localIndexChanged;
      localIndexChanged = false;
      const publishing = { all: publishAll, read: readAll };
      publishAll = false;
      readAll = false;
      const own = [...changedSessions];
      changedSessions.clear();
      try {
        const local = captured || own.length > 0 || publisher.hasPendingHeads();
        lastRun = await waitForPersonalRun(lastRun, publishing.read, local);
        if (captured) {
          const previous = await activity.run("personal-index", () => index.capture(full), attemptSignal);
          await channel.prepare(personal, index.streaming);
          previews.admitted(previous);
        }
        attemptSignal.throwIfAborted();
        const sessions = publishing.all ? [...index.owned] : own.filter((id) => index.owned.has(id));
        for (const id of sessions) publishingSessions.add(id);
        await activity.run(
          "publishing-history",
          () => publisher.publish(sessions, personal, documents.relayFor(personal), { skipUnchanged: publishing.all }),
          attemptSignal,
        );
        attemptSignal.throwIfAborted();
        previews.flush();
        const remote = remoteIndexChanged;
        remoteIndexChanged = false;
        const indexSynced = await activity.run(
          "personal-index",
          () => publisher.synchronizeIndex(full, captured, remote),
          attemptSignal,
        );
        attemptSignal.throwIfAborted();
        if (indexSynced) await channel.prepare(personal, index.streaming);
        if (publishing.read || indexSynced || captured)
          await activity.run(
            "receiving-history",
            () => readLogs(personal, documents.relayFor(personal), history, index.owned, progress, input.statusChanged),
            attemptSignal,
          );
        if (indexSynced) await announcements.announce();
        firstDownloaded ||= progress.status(new Set()).downloaded && (await documents.status()).downloaded;
        activity.complete();
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
    logSource: history.logSource,
    watchingChanged: (id, active) => publisher.watch(id, active, channel.send),
    logChanged: (id, format) => {
      requestLog(id, format);
      if (!documents.space) return;
      const space = documents.space;
      void connection
        .admit(() => activity.run("receiving-history", () => catchUp(id, space, documents.relayFor(space), format)))
        .catch(() => {
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
    restart: connection.restart,
    async status() {
      const indexStatus = await documents.status(publisher.hasPendingHeads());
      const pending = new Set([...changedSessions, ...publishingSessions].filter((id) => index.owned.has(id)));
      const logs = progress.status(pending);
      return {
        ...personalHistoryProgress(indexStatus, logs, firstDownloaded, connection.status()),
        ...activity.status(),
      };
    },
    done: connection.done.finally(async () => {
      await stopWatching();
      closePersonalResources([channel, documents, publisher, liveReceiver, activity]);
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
