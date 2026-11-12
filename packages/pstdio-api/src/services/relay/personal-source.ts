import type { LiveConnection, SubscribeDocument } from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createLogProgress } from "../personal-history/log-progress";
import { createPersonalContext, createPersonalReaders } from "./personal-context";
import { createPersonalDocuments } from "./personal-documents";
import { createPersonalPublication } from "./personal-publication";
import type { RelayWorkbench } from "./runtime";
import type { createSourceActivity } from "./source-activity";

export interface RelayPersonalInput {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  live?: LiveConnection;
  statusChanged?: () => void;
}

export const createPersonalSource = (
  input: RelayPersonalInput & {
    activity: ReturnType<typeof createSourceActivity>;
    subscribe: SubscribeDocument;
    interested(id: string): boolean;
    failed(id: string): void;
    wake(): void;
    admit<T>(work: () => Promise<T>): Promise<T>;
  },
) => {
  const { config, deps, signal, activity } = input;
  const context = createPersonalContext(config, deps);
  const { history, namespace } = context;
  const documents = createPersonalDocuments({
    config,
    context,
    signal,
    access: input.access,
    subscribe: input.subscribe,
    progress: activity.network,
  });
  const publishingSessions = new Set<string>();
  const publisher = createPersonalPublication({
    files: deps.personalHistoryService.logs,
    namespace,
    deviceId: config.environmentId,
    streams: context.streams,
    deps,
    interested: input.interested,
    published: (sessionId) => publishingSessions.delete(sessionId),
    failed: input.failed,
    wake: input.wake,
    statusChanged: input.statusChanged,
    history,
    documents,
    admit: input.admit,
  });
  const readers = createPersonalReaders(
    deps,
    deps.personalHistoryService.logs,
    namespace,
    config.environmentId,
    context,
  );
  return { context, documents, publishingSessions, publisher, readers, progress: createLogProgress() };
};
