import type { DocumentStore, StorageOwner, SyncSpace } from "pstdio-sync";
import {
  createDocumentRelay,
  createDocumentSync,
  fetchSyncSpaces,
  type ProjectRelayConnection,
} from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createLogPublisher } from "../personal-history/log-publisher";
import { historyReferenceName } from "../personal-history/references";
import { createPersonalAnnouncements } from "./personal-announcements";
import {
  capturePersonalIndex,
  createPersonalContext,
  createPersonalReaders,
  discardLegacyHistory,
  personalLiveReceiver,
} from "./personal-context";
import { createSyncQuarantine } from "./quarantine";
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
}) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  let requestSignal = signal;
  const token = async () => (await input.access()).token;
  const { history, references, namespace } = createPersonalContext(config, deps);
  const logs = deps.personalHistoryService.logs;
  const publisher = createLogPublisher({
    files: logs,
    namespace,
    deviceId: config.environmentId,
    deps,
    published: (sessionId, head) => {
      pendingHeads.set(sessionId, head);
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
  let spaces: { personal: SyncSpace; project: SyncSpace } | undefined;
  let records: ReturnType<typeof createDocumentSync> | undefined;
  let shared: ReturnType<typeof createDocumentSync> | undefined;
  let recordsDocumentId: string | undefined;
  // Publishing everything is needed once per process: changes made before it started were never tracked.
  // Reading everything is needed after a lost connection: the relay's change notices were missed.
  let publishAll = true;
  let readAll = true;
  // The index changed here (session or workspace rows), or the relay reported another device's change.
  let localIndexChanged = true;
  let remoteIndexChanged = true;
  let referencesDocumentId: string | undefined;
  let lastRun = 0;
  // Log heads only matter for catching up after a lost connection; change notices carry new entries at once.
  // Writing them in batches keeps the index from syncing after every message.
  const pendingHeads = new Map<string, number>();
  let headsWritten = 0;
  let headsTimer: ReturnType<typeof setTimeout> | undefined;
  let keys: Awaited<ReturnType<typeof fetchSyncSpaces>>;
  let keysFor: AbortSignal | undefined;
  let legacyDiscarded = false;
  let ownSessions = new Set<string>();
  const changedSessions = new Set<string>();
  const changedDocuments = new Set<string>();

  const announcements = createPersonalAnnouncements(deps, config.workbenchId, signal);
  const relayFor = (space: SyncSpace) => (documentId: string) => {
    connection.claim(documentId);
    return createDocumentRelay({
      origin: config.relayOrigin,
      space,
      documentId,
      get signal() {
        return requestSignal;
      },
      token,
    });
  };
  const syncFor = (owner: StorageOwner, store: DocumentStore, space: SyncSpace, documentId: string) =>
    createDocumentSync({
      owner,
      store,
      space,
      documentId,
      relay: relayFor(space)(documentId),
      quarantine: createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId }),
    });

  const capture = async () => {
    ownSessions = await capturePersonalIndex(deps, config, history, references);
  };
  const remoteSessions = async () =>
    (await history.readRecords("sessions"))
      .filter((row) => (row.device as { id?: string } | undefined)?.id !== config.environmentId)
      .map((row) => String(row.id));
  const receiveLive = personalLiveReceiver(liveReceiver, () => spaces?.personal);

  const prepare = async (attemptSignal: AbortSignal) => {
    requestSignal = attemptSignal;
    if (!legacyDiscarded) {
      await discardLegacyHistory(config, deps);
      legacyDiscarded = true;
    }
    if (keysFor !== attemptSignal) {
      keys = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal: attemptSignal });
      keysFor = attemptSignal;
      liveReceiver.reset();
      readAll = true;
      remoteIndexChanged = true;
    }
    if (
      spaces?.personal.generation !== keys.personal.generation ||
      spaces?.project.generation !== keys.project.generation
    ) {
      records?.close();
      shared?.close();
      spaces = keys;
      recordsDocumentId = await keys.personal.documentId(JSON.stringify(["pstdio.personal-history", "records-v2"]));
      records = syncFor(history.owner, history.records, keys.personal, recordsDocumentId);
      referencesDocumentId = await keys.project.documentId(historyReferenceName);
      shared = syncFor(references.owner, references.store, keys.project, referencesDocumentId);
      publishAll = true;
      readAll = true;
    }
    return spaces!;
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
    const pending = wrote && ((await records!.status()).pending || (await shared!.status()).pending);
    if (!received && !pending) return false;
    remoteIndexChanged = false;
    await records!.synchronize();
    await shared!.synchronize();
    return true;
  };
  const readLogs = async (personal: SyncSpace, hinted: Set<string>) => {
    const remote = await remoteSessions();
    const reading = new Set(await receiver.changed(hinted, remote, personal));
    for (const id of await receiver.behind(remote, await history.readHeads())) reading.add(id);
    await receiver.read(reading, personal, relayFor(personal));
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
    },
    onChanged: ({ documentId }) => {
      if (documentId === recordsDocumentId || documentId === referencesDocumentId) remoteIndexChanged = true;
      else changedDocuments.add(documentId);
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
        await publisher.publish(sessions, personal, relayFor(personal), { skipUnchanged: publishing.all });
        attemptSignal.throwIfAborted();
        const indexSynced = await synchronizeIndex(full, captured);
        attemptSignal.throwIfAborted();
        if (publishing.read || hinted.size || indexSynced) await readLogs(personal, hinted);
        if (indexSynced) await announcements.announce();
      } catch (error) {
        interrupted(publishing, own, hinted);
        throw error;
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
    // A session row change can come with a saved checkpoint or a finished message.
    if (event.table === "sessions") changedSessions.add((event.data as { id: string }).id);
    localIndexChanged = true;
    connection.wake();
  });
  const stopConversations = deps.sessionService.store.watch((id) => {
    changedSessions.add(id);
    if (spaces) publisher.live(id, spaces.personal, connection.send);
    connection.wake();
  });
  return {
    done: connection.done.finally(() => {
      records?.close();
      shared?.close();
      publisher.close();
      liveReceiver.close();
      clearTimeout(headsTimer);
    }),
    close() {
      stopEvents();
      stopConversations();
      controller.abort();
      announcements.clear();
    },
  };
};
