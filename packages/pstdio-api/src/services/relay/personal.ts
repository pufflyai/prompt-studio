import { hostname } from "node:os";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  fetchSyncSpaces,
} from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { capturePersonalHistory } from "../personal-history/capture";
import { createHistoryReferences, historyReferenceName } from "../personal-history/references";
import { createPersonalHistoryStore } from "../personal-history/store";
import { createPersonalDocumentSync } from "../personal-history/synchronize";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

export const startRelayPersonalHistory = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const history = createPersonalHistoryStore({
    projectId: config.workbenchId,
    accountId: config.accountId,
    managerOrigin: config.managerOrigin,
    documents: deps.extensionStorageService.documents,
  });
  let documents: ReturnType<typeof createPersonalDocumentSync> | undefined;
  const references = createHistoryReferences(
    deps.extensionStorageService.documents.open(historyReferenceName),
    config.workbenchId,
  );
  let shared: ReturnType<typeof createDocumentSync> | undefined;
  let attempt: AbortSignal | undefined;
  let generation: number | undefined;
  let projectGeneration: number | undefined;
  const projectDocuments = new Set<string>();
  const published = new Map<string, string>();
  const publish = async () => {
    const state = await deps.personalHistoryService.fullState(config.workbenchId);
    if (signal.aborted) return;
    const next = new Map<string, string>();
    for (const [table, rows] of Object.entries(state)) {
      for (const row of rows) {
        const key = JSON.stringify([table, row.id]);
        const value = JSON.stringify(row);
        next.set(key, value);
        if (published.get(key) !== value) deps.eventBus.emit(table, "set", row);
      }
    }
    for (const key of published.keys())
      if (!next.has(key)) {
        const [table, id] = JSON.parse(key);
        deps.eventBus.emit(table, "delete", { id });
      }
    published.clear();
    for (const [key, value] of next) published.set(key, value);
  };
  const capture = async () => {
    const devices = await deps.accountService.devices();
    const device = {
      ownerId: config.accountId,
      id: config.environmentId,
      name: devices.find((device) => device.id === config.environmentId)?.name ?? hostname(),
    };
    await capturePersonalHistory({ projectId: config.workbenchId, device, history, references, deps });
  };
  const connection = createDocumentRelayConnection({
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    signal,
    access: input.access,
    acceptsChange: (change) =>
      change.spaceOwner === config.accountId || (change.spaceOwner === null && projectDocuments.has(change.documentId)),
    synchronize: async (attemptSignal) => {
      const { personal, project } = await fetchSyncSpaces({
        ...config,
        credential: config.renewalGrant,
        signal: attemptSignal,
      });
      if (attempt !== attemptSignal || generation !== personal.generation || projectGeneration !== project.generation) {
        documents?.close();
        shared?.close();
        projectDocuments.clear();
        attempt = attemptSignal;
        generation = personal.generation;
        projectGeneration = project.generation;
        documents = createPersonalDocumentSync({
          history,
          space: personal,
          relay: (documentId) =>
            createDocumentRelay({
              origin: config.relayOrigin,
              space: personal,
              documentId,
              signal: attemptSignal,
              token: async () => (await input.access()).token,
            }),
          quarantine: (documentId, failure) =>
            createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId })(failure),
        });
        const documentId = await project.documentId(historyReferenceName);
        projectDocuments.add(documentId);
        shared = createDocumentSync({
          owner: references.owner,
          store: references.store,
          space: project,
          documentId,
          relay: createDocumentRelay({
            origin: config.relayOrigin,
            space: project,
            documentId,
            signal: attemptSignal,
            token: async () => (await input.access()).token,
          }),
          quarantine: createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId }),
        });
      }
      await documents!.synchronize(capture);
      attemptSignal.throwIfAborted();
      await shared!.synchronize();
      attemptSignal.throwIfAborted();
      await publish();
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.personal.reconnecting", workbenchId: config.workbenchId },
        "Personal history sync will retry",
      ),
  });
  const stopEvents = deps.eventBus.subscribe((event) => {
    if (["sessions", "workspaces", "workspace_sessions"].includes(event.table)) connection.wake();
  });
  const stopConversations = deps.sessionService.store.watch(() => connection.wake());
  return {
    done: connection.done.finally(() => {
      documents?.close();
      shared?.close();
    }),
    close() {
      stopEvents();
      stopConversations();
      controller.abort();
      for (const key of published.keys()) {
        const [table, id] = JSON.parse(key);
        deps.eventBus.emit(table, "delete", { id });
      }
      published.clear();
    },
  };
};
