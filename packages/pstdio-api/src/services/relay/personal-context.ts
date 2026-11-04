import { hostname } from "node:os";
import { openLive, type SyncSpace } from "pstdio-sync/encryption";
import type { DocumentRelay } from "pstdio-sync/relay";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { capturePersonalHistory } from "../personal-history/capture";
import { createLiveReceiver, personalLiveTopic } from "../personal-history/live-messages";
import { historyNamespace, type SessionLogFiles } from "../personal-history/log-files";
import type { createLogProgress } from "../personal-history/log-progress";
import { createLogReceiver } from "../personal-history/log-receiver";
import { createPersonalLogStreams } from "../personal-history/log-stream";
import { createHistoryReferences, historyReferenceName } from "../personal-history/references";
import { createPersonalHistoryStore, type PersonalHistoryStore } from "../personal-history/store";
import type { RelayWorkbench } from "./runtime";

export const capturePersonalIndex = async (
  deps: ExtensionsRouteDeps,
  config: RelayWorkbench,
  history: PersonalHistoryStore,
  references: ReturnType<typeof createHistoryReferences>,
) => {
  const devices = await deps.accountService.devices();
  const device = {
    ownerId: config.accountId,
    id: config.environmentId,
    name: devices.find((device) => device.id === config.environmentId)?.name ?? hostname(),
  };
  return await capturePersonalHistory({ projectId: config.workbenchId, device, history, references, deps });
};

export const remotePersonalSessions = async (history: PersonalHistoryStore, deviceId: string) =>
  (await history.readRecords("sessions"))
    .filter((row) => (row.device as { id?: string } | undefined)?.id !== deviceId)
    .map((row) => String(row.id));

export const personalLiveReceiver =
  (receiver: ReturnType<typeof createLiveReceiver>, space: () => SyncSpace | undefined) =>
  async (message: Extract<LiveServerMessage, { type: "event" }>) => {
    const personal = space();
    if (
      !personal ||
      message.spaceOwner !== personal.spaceOwner ||
      message.topic !== (await personalLiveTopic(personal))
    )
      return;
    receiver.receive(JSON.parse(new TextDecoder().decode(await openLive(personal, message))));
  };

export const createPersonalContext = (config: RelayWorkbench, deps: ExtensionsRouteDeps) => {
  const history = createPersonalHistoryStore({
    projectId: config.workbenchId,
    accountId: config.accountId,
    managerOrigin: config.managerOrigin,
    documents: deps.extensionStorageService.documents,
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
  return { history, references, namespace, logs: deps.extensionStorageService.logs, streams };
};

/** The old index is small. Never open a legacy transcript or replay its journal during upgrade. */
export const discardLegacyHistory = async (config: RelayWorkbench, deps: ExtensionsRouteDeps) => {
  const owner = {
    workbenchId: config.workbenchId,
    extensionId: JSON.stringify(["pstdio.personal-history", config.managerOrigin, config.accountId]),
  };
  const documents = deps.extensionStorageService.documents;
  const names = await documents.list(owner);
  for (const name of names) await documents.discard(owner, name);
};

export const createPersonalReaders = (input: {
  deps: ExtensionsRouteDeps;
  logs: SessionLogFiles;
  context: ReturnType<typeof createPersonalContext>;
  config: RelayWorkbench;
  progress: ReturnType<typeof createLogProgress>;
  relayFor: (space: SyncSpace) => (id: string) => DocumentRelay;
  statusChanged?: () => void;
}) => {
  const { deps, logs, context, config, progress } = input;
  const liveReceiver = createLiveReceiver((id, index, message) =>
    deps.personalHistoryService.messageReceived(id, { index, message, live: true }),
  );
  const receiver = createLogReceiver({
    files: logs,
    namespace: context.namespace,
    streams: context.streams,
    source: context.history.logSource,
    received: (sessionId, index, message) => {
      liveReceiver.completed(sessionId, index);
      deps.personalHistoryService.messageReceived(sessionId, { index, message, live: false });
    },
  });

  return {
    liveReceiver,
    async readLogs(ownSessions: Set<string>, personal: SyncSpace) {
      const remote = await remotePersonalSessions(context.history, config.environmentId);
      const reading = new Set(await receiver.behind(remote, await context.history.readHeads()));
      progress.receive(ownSessions, remote, reading);
      input.statusChanged?.();
      for (const id of reading) {
        await receiver.read([id], personal, input.relayFor(personal));
        progress.received(id);
        input.statusChanged?.();
      }
    },
  };
};
