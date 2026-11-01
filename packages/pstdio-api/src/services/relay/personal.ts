import type { SyncSpace } from "pstdio-sync";
import type { ProjectRelayConnection } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createLogProgress, personalHistoryProgress } from "../personal-history/log-progress";
import { createLogPublisher } from "../personal-history/log-publisher";
import { createPersonalAnnouncements } from "./personal-announcements";
import {
  capturePersonalIndex,
  createPersonalContext,
  createPersonalReaders,
  discardLegacyHistory,
  personalLiveReceiver,
} from "./personal-context";
import { createPersonalDocuments } from "./personal-documents";
import type { RelayWorkbench } from "./runtime";

/**
 * Publishes this device's session history to the user's private space and copies the user's other devices'
 * history here. The session index is a small CRDT document. Each conversation is an append-only log of
 * completed messages, and streaming text goes over the live channel, which stores nothing.
 */
export const startRelayPersonalHistory = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  relay: ProjectRelayConnection;
  statusChanged?: () => void;
}) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const context = createPersonalContext(config, deps);
  const { history, references, namespace } = context;
  const documents = createPersonalDocuments({
    config,
    context,
    signal,
    access: input.access,
    claim: (id) => connection.claim(id),
  });
  const logs = deps.personalHistoryService.logs;
  const progress = createLogProgress();
  const publishingSessions = new Set<string>();
  let firstDownloaded = false;
  const publisher = createLogPublisher({
    files: logs,
    namespace,
    deviceId: config.environmentId,
    deps,
    published: (sessionId, head) => {
      publishingSessions.delete(sessionId);
      pendingHeads.set(sessionId, head);
      input.statusChanged?.();
      // An idle device still writes its heads.
      headsTimer ??= setTimeout(() => {
        headsTimer = undefined;
        connection.wake();
      }, 10_500);
    },
  });
  const { liveReceiver, receiver } = createPersonalReaders(deps, logs, namespace);

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
  // Log heads only matter for catching up after a lost connection; change notices carry new entries at once.
  // Writing them in batches keeps the index from syncing after every message.
  const pendingHeads = new Map<string, number>();
  let headsWritten = 0;
  let headsTimer: ReturnType<typeof setTimeout> | undefined;
  let legacyDiscarded = false;
  let ownSessions = new Set<string>();
  const changedSessions = new Set<string>();
  const changedDocuments = new Set<string>();

  const announcements = createPersonalAnnouncements(deps, config.workbenchId, signal);
  const relayFor = documents.relayFor;
  const capture = async () => {
    ownSessions = await capturePersonalIndex(deps, config, history, references);
  };
  const remoteSessions = async () =>
    (await history.readRecords("sessions"))
      .filter((row) => (row.device as { id?: string } | undefined)?.id !== config.environmentId)
      .map((row) => String(row.id));
  const receiveLive = personalLiveReceiver(liveReceiver, () => documents.space);

  const prepare = async (attemptSignal: AbortSignal) => {
    if (!legacyDiscarded) {
      await discardLegacyHistory(config, deps);
      legacyDiscarded = true;
    }
    const prepared = await documents.prepare(attemptSignal);
    if (prepared.renewed) {
      liveReceiver.reset();
      readAll = true;
      remoteIndexChanged = true;
      progress.invalidate();
    }
    publishAll ||= prepared.recreated;
    return prepared;
  };
  const synchronizeIndex = async (full: boolean, captured: boolean) => {
    const writeHeads = pendingHeads.size > 0 && (full || captured || Date.now() - headsWritten > 10_000);
    if (writeHeads) {
      await history.writeHeads(new Map(pendingHeads));
      pendingHeads.clear();
      headsWritten = Date.now();
    }
    const received = full || remoteIndexChanged;
    const wrote = captured || writeHeads;
    const pending = wrote && (await documents.status()).pending;
    if (!received && !pending) return false;
    remoteIndexChanged = false;
    await documents.synchronize();
    return true;
  };
  const readLogs = async (personal: SyncSpace, hinted: Set<string>) => {
    const remote = await remoteSessions();
    const reading = new Set(await receiver.changed(hinted, remote, personal));
    for (const id of await receiver.behind(remote, await history.readHeads())) reading.add(id);
    progress.receive(ownSessions, remote, reading);
    input.statusChanged?.();
    for (const id of reading) {
      await receiver.read([id], personal, relayFor(personal));
      progress.received(id);
      input.statusChanged?.();
    }
  };
  const interrupted = (publishing: { all: boolean; read: boolean }, own: string[], hinted: Set<string>) => {
    publishAll ||= publishing.all;
    readAll ||= publishing.read;
    for (const id of own) changedSessions.add(id);
    for (const id of hinted) changedDocuments.add(id);
    localIndexChanged = true;
    remoteIndexChanged = true;
  };
  const connection = input.relay.attach({
    signal,
    personal: true,
    onStatusChange: () => {
      if (!connection.status().connected) {
        readAll = true;
        liveReceiver.reset();
      }
      input.statusChanged?.();
    },
    onChanged: ({ documentId }) => {
      if (documents.owns(documentId)) remoteIndexChanged = true;
      else changedDocuments.add(documentId);
      progress.invalidate();
      input.statusChanged?.();
    },
    onLive: (message) => {
      receiveLive(message).catch(() => {});
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
      const hinted = new Set(changedDocuments);
      changedSessions.clear();
      changedDocuments.clear();
      try {
        const captured = full || localIndexChanged;
        if (captured) {
          localIndexChanged = false;
          await capture();
        }
        attemptSignal.throwIfAborted();
        const sessions = publishing.all ? [...ownSessions] : own.filter((id) => ownSessions.has(id));
        sessions.forEach((id) => {
          publishingSessions.add(id);
        });
        await publisher.publish(sessions, personal, relayFor(personal), { skipUnchanged: publishing.all });
        publishingSessions.clear();
        attemptSignal.throwIfAborted();
        const indexSynced = await synchronizeIndex(full, captured);
        attemptSignal.throwIfAborted();
        if (publishing.read || hinted.size || indexSynced || captured) await readLogs(personal, hinted);
        if (indexSynced) await announcements.announce();
        firstDownloaded ||= progress.status(new Set()).downloaded && (await documents.status()).downloaded;
      } catch (error) {
        interrupted(publishing, own, hinted);
        throw error;
      } finally {
        publishingSessions.clear();
        input.statusChanged?.();
      }
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.personal.reconnecting", workbenchId: config.workbenchId },
        "Personal history sync will retry",
      ),
  });
  const stopEvents = deps.eventBus.subscribe((event) => {
    if (announcements.state.announcing || !["sessions", "workspaces", "workspace_sessions"].includes(event.table))
      return;
    const projectId = (event.data as { project_id?: string }).project_id;
    if (projectId && projectId !== config.workbenchId) return;
    // A session row change can come with a saved checkpoint or a finished message.
    if (event.table === "sessions") changedSessions.add((event.data as { id: string }).id);
    localIndexChanged = true;
    progress.invalidate();
    input.statusChanged?.();
    connection.wake();
  });
  const stopConversations = deps.sessionService.store.watch((id) => {
    changedSessions.add(id);
    input.statusChanged?.();
    if (documents.space) publisher.live(id, documents.space, connection.send);
    connection.wake();
  });
  const stopStorage = deps.extensionStorageService.watch((owner) => {
    if (owner.workbenchId === history.owner.workbenchId && owner.extensionId === history.owner.extensionId)
      input.statusChanged?.();
  });
  return {
    retry: connection.retry,
    async status() {
      const index = await documents.status(pendingHeads.size > 0);
      const pending = new Set([...changedSessions, ...publishingSessions].filter((id) => ownSessions.has(id)));
      const logs = progress.status(pending);
      return personalHistoryProgress(index, logs, firstDownloaded, connection.status());
    },
    done: connection.done.finally(() => {
      documents.close();
      publisher.close();
      liveReceiver.close();
      clearTimeout(headsTimer);
    }),
    close() {
      stopEvents();
      stopConversations();
      stopStorage();
      controller.abort();
      announcements.clear();
    },
  };
};
