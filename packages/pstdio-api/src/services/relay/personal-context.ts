import { hostname } from "node:os";
import { openLive, type SyncSpace } from "pstdio-sync";
import type { LiveServerMessage } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { capturePersonalHistory } from "../personal-history/capture";
import { createLiveReceiver } from "../personal-history/live-messages";
import { historyNamespace, type SessionLogFiles } from "../personal-history/log-files";
import { createLogReceiver } from "../personal-history/log-receiver";
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

export const personalLiveReceiver =
  (receiver: ReturnType<typeof createLiveReceiver>, space: () => SyncSpace | undefined) =>
  async (message: Extract<LiveServerMessage, { type: "live" }>) => {
    const personal = space();
    if (!personal || message.spaceOwner !== personal.spaceOwner) return;
    receiver.receive(JSON.parse(new TextDecoder().decode(await openLive(personal, message))));
  };

export const createPersonalContext = (config: RelayWorkbench, deps: ExtensionsRouteDeps) => {
  const history = createPersonalHistoryStore({
    projectId: config.workbenchId,
    accountId: config.accountId,
    managerOrigin: config.managerOrigin,
    documents: deps.extensionStorageService.documents,
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
  return { history, references, namespace };
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

export const createPersonalReaders = (deps: ExtensionsRouteDeps, logs: SessionLogFiles, namespace: string) => {
  const liveReceiver = createLiveReceiver((id, index, message) =>
    deps.personalHistoryService.messageReceived(id, { index, message, live: true }),
  );
  const receiver = createLogReceiver({
    files: logs,
    namespace,
    received: (sessionId, index, message) => {
      liveReceiver.completed(sessionId, index);
      deps.personalHistoryService.messageReceived(sessionId, { index, message, live: false });
    },
  });

  return { liveReceiver, receiver };
};
