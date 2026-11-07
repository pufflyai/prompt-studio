import { hostname } from "node:os";
import { openLive, type SyncSpace } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { capturePersonalHistory, captureSessionChanges } from "../personal-history/capture";
import { createLiveReceiver, personalLiveTopic } from "../personal-history/live-messages";
import { historyNamespace, type SessionLogFiles } from "../personal-history/log-files";
import type { createLogProgress } from "../personal-history/log-progress";
import { createLogReceiver } from "../personal-history/log-receiver";
import { createPersonalLogStreams } from "../personal-history/log-stream";
import { createHistoryReferences, historyReferenceName } from "../personal-history/references";
import { createPersonalHistoryStore, type PersonalHistoryStore } from "../personal-history/store";
import type { RelayWorkbench } from "./runtime";

const names = new WeakMap<
  ExtensionsRouteDeps,
  Map<string, ReturnType<ExtensionsRouteDeps["accountService"]["devices"]>>
>();
const deviceNames = (deps: ExtensionsRouteDeps, config: RelayWorkbench) => {
  let logins = names.get(deps);
  if (!logins) {
    logins = new Map();
    names.set(deps, logins);
  }
  const key = JSON.stringify([config.managerOrigin, config.accountId, config.environmentId, config.renewalGrant]);
  let pending = logins.get(key);
  if (!pending) {
    pending = deps.accountService.devices().catch((error) => {
      logins.delete(key);
      throw error;
    });
    logins.set(key, pending);
  }
  return pending;
};

export const capturePersonalIndex = async (
  deps: ExtensionsRouteDeps,
  config: RelayWorkbench,
  history: PersonalHistoryStore,
  references: ReturnType<typeof createHistoryReferences>,
  sessionIds?: string[],
) => {
  const devices = await deviceNames(deps, config);
  const device = {
    ownerId: config.accountId,
    id: config.environmentId,
    name: devices.find((device) => device.id === config.environmentId)?.name ?? hostname(),
  };
  const input = { projectId: config.workbenchId, device, history, references, deps };
  return sessionIds ? captureSessionChanges(input, sessionIds) : capturePersonalHistory(input);
};

export const remotePersonalSessions = async (history: PersonalHistoryStore, deviceId: string) =>
  (await history.readRecords("sessions"))
    .filter((row) => (row.device as { id?: string } | undefined)?.id !== deviceId)
    .map((row) => String(row.id));

export const personalLiveReceiver =
  (receiver: ReturnType<typeof createLiveReceiver>, space: () => SyncSpace | undefined) =>
  async (message: Extract<LiveServerMessage, { type: "event" }>) => {
    const personal = space();
    if (!personal || message.spaceOwner !== personal.spaceOwner) return;
    const value = JSON.parse(new TextDecoder().decode(await openLive(personal, message)));
    if (!Array.isArray(value)) return;
    for (const frame of value)
      if (typeof frame.sessionId !== "string" || message.topic !== (await personalLiveTopic(personal, frame.sessionId)))
        return;
    receiver.receive(value);
  };

export const createPersonalContext = (config: RelayWorkbench, deps: ExtensionsRouteDeps) => {
  const history = createPersonalHistoryStore({
    projectId: config.workbenchId,
    accountId: config.accountId,
    managerOrigin: config.managerOrigin,
    documents: deps.extensionStorageService.documents,
    files: deps.personalHistoryService.logs,
    index: deps.extensionStorageService.personalHistoryIndex,
    logs: deps.extensionStorageService.logs,
  });
  const references = createHistoryReferences(
    deps.extensionStorageService.documents.open(historyReferenceName),
    config.workbenchId,
  );
  const namespace = historyNamespace({
    managerOrigin: config.managerOrigin,
    accountId: config.accountId,
    projectId: config.workbenchId,
  });
  const streams = createPersonalLogStreams({
    owner: history.owner,
    service: deps.extensionStorageService.logs,
    files: deps.personalHistoryService.logs,
    namespace,
  });
  return {
    history,
    references,
    namespace,
    streams,
    logs: deps.extensionStorageService.logs,
  };
};

export const createPersonalReaders = (
  deps: ExtensionsRouteDeps,
  logs: SessionLogFiles,
  namespace: string,
  deviceId: string,
  context: ReturnType<typeof createPersonalContext>,
) => {
  const liveReceiver = createLiveReceiver((id, index, message) =>
    deps.personalHistoryService.messageReceived(id, { index, message, live: true }),
  );
  const receiver = createLogReceiver({
    files: logs,
    namespace,
    streams: context.streams,
    source: context.history.logSource,
    received: (sessionId, index, message) => {
      liveReceiver.completed(sessionId, index);
      deps.personalHistoryService.messageReceived(sessionId, { index, message, live: false });
    },
  });

  const requested = new Map<string, { format?: "append-log-v1" }>();
  const catchUp = async (
    id: string,
    personal: SyncSpace,
    relay: (id: string) => DocumentRelay,
    format?: "append-log-v1",
  ) => {
    const request = { format };
    requested.set(id, request);
    await receiver.read([id], personal, relay, format);
    if (requested.get(id) === request) requested.delete(id);
  };
  return {
    liveReceiver,
    requestLog: (id: string, format?: "append-log-v1") => requested.set(id, { format }),
    catchUp,
    async readLogs(
      personal: SyncSpace,
      relay: (id: string) => DocumentRelay,
      history: PersonalHistoryStore,
      own: Set<string>,
      progress: ReturnType<typeof createLogProgress>,
      statusChanged?: () => void,
    ) {
      const remote = await remotePersonalSessions(history, deviceId);
      const reading = new Set([...requested.keys(), ...(await receiver.behind(remote, await history.readHeads()))]);
      progress.receive(own, remote, reading);
      statusChanged?.();
      for (const id of reading) {
        await catchUp(id, personal, relay, requested.get(id)?.format);
        progress.received(id);
        statusChanged?.();
      }
    },
  };
};
