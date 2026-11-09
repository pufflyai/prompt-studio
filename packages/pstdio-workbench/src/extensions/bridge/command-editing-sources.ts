import type { ScopedQuery, ScopedQueryClient } from "@pstdio/sdk/extensions";
import {
  resolveEventReferenceId,
  type WebviewEditingCommandResult,
  type WebviewEditingSource,
} from "pstdio-api-contracts/extension-kernel";
import {
  assertEditingCommandOwner,
  type CommandEditingOpen,
  type EditingExecutor,
  type EditingOwner,
} from "./command-editing-types";
import { webviewEditingLoadSchema, webviewEditingResultSchema } from "./webview-editing-params";

interface Source {
  descriptor: WebviewEditingSource;
  query: ScopedQuery<WebviewEditingCommandResult>;
  last?: WebviewEditingCommandResult;
  error?: Error;
  stop?: () => void;
}
type Observation = "active" | "passive" | "none";

export const createCommandEditingSources = (input: {
  queries: ScopedQueryClient;
  owner: Pick<EditingOwner, "projectId" | "extensionId">;
  open: CommandEditingOpen;
  execute(): EditingExecutor;
  serialize: <T>(run: () => Promise<T>, signal?: AbortSignal) => Promise<T>;
  accept(result: WebviewEditingCommandResult): void;
  validate(result: WebviewEditingCommandResult): WebviewEditingCommandResult;
  changed(): void;
  retired(): void;
}) => {
  const scope = input.queries.forScope({ projectId: input.owner.projectId, extensionId: input.owner.extensionId });
  const sources: Source[] = [];
  let mode: Observation = "none";
  let propagating = false;
  let disposed = false;
  const initial = scope.query({
    id: "editing.command.initial",
    resourceKey: input.open.key,
    params: input.open.read,
    dependsOn: input.open.dependsOn.map((event) => resolveEventReferenceId(event, input.owner.extensionId)),
    read: (signal) =>
      input.serialize(
        async () => webviewEditingLoadSchema.parse(await input.execute()(input.open.read, signal)),
        signal,
      ),
  });
  let stopInitial = initial.subscribe(
    () => {
      if (!disposed && initial.isDisposed()) input.retired();
    },
    { automatic: false },
  );
  const accept = (result: WebviewEditingCommandResult, sourceId?: string) => {
    let ids = result.sourceIds;
    if (!ids) {
      ids = sourceId ? [sourceId] : [];
      if (!sourceId && result.value !== undefined) ids = sources.map((source) => source.descriptor.id);
    }
    propagating = true;
    try {
      for (const source of sources) {
        if (!ids.includes(source.descriptor.id)) continue;
        source.query.accept(result);
        source.last = source.query.getSnapshot().data;
        source.error = source.query.getSnapshot().error;
      }
    } finally {
      propagating = false;
    }
  };
  const changed = (source: Source) => {
    if (disposed) return;
    if (source.query.isDisposed()) {
      input.retired();
      return;
    }
    if (propagating) return;
    const next = source.query.getSnapshot();
    const changedError = source.error !== next.error;
    source.error = next.error;
    const result = next.data;
    if (next.error || !result || result === source.last) {
      if (changedError) input.changed();
      return;
    }
    source.last = result;
    accept(result, source.descriptor.id);
    input.accept(result);
  };
  const observe = (next: Observation) => {
    if (disposed || mode === next) return;
    mode = next;
    for (const source of sources) {
      const previous = source.stop;
      source.stop =
        next === "none" ? undefined : source.query.subscribe(() => changed(source), { automatic: next === "active" });
      previous?.();
      if (next !== "active" && source.query.getSnapshot().fetching) source.query.cancel();
    }
  };
  return {
    accept,
    observe,
    error() {
      const source = sources.find((entry) => entry.query.getSnapshot().error);
      if (source) return { message: source.query.getSnapshot().error!.message, sourceId: source.descriptor.id };
    },
    async retry() {
      const failed = sources.filter((source) => source.query.getSnapshot().error);
      for (const source of failed) source.query.invalidate();
      await Promise.all(failed.map((source) => source.query.read()));
    },
    retired: () => disposed || sources.some((source) => source.query.isDisposed()),
    async initialize() {
      const loaded = await initial.read();
      if (disposed || initial.isDisposed()) throw new Error("editing_session_closed");
      const unique = new Set<string>();
      for (const descriptor of loaded.sources) {
        assertEditingCommandOwner(input.owner.extensionId, descriptor.read.commandId);
        if (unique.has(descriptor.id)) throw new Error("editing_source_duplicate");
        unique.add(descriptor.id);
      }
      input.accept({ value: loaded.value });
      for (const descriptor of loaded.sources) {
        const query = scope.query<WebviewEditingCommandResult>({
          id: "editing.command.source",
          resourceKey: input.open.key,
          params: { id: descriptor.id, read: descriptor.read },
          dependsOn: descriptor.dependsOn.map((event) => resolveEventReferenceId(event, input.owner.extensionId)),
          dependency: descriptor.dependency,
          read: (signal) =>
            input.serialize(
              async () =>
                input.validate(webviewEditingResultSchema.parse(await input.execute()(descriptor.read, signal))),
              signal,
            ),
        });
        const source: Source = { descriptor, query };
        sources.push(source);
        source.stop = query.subscribe(() => changed(source), { automatic: false });
      }
      accept({ value: loaded.value });
      // Initial publication can deliver a shared change before the source watches exist.
      if (initial.inspect().stale) for (const source of sources) source.query.invalidate();
      stopInitial();
      stopInitial = () => undefined;
      initial.dispose();
      const desired = mode;
      mode = desired === "none" ? "passive" : "none";
      observe(desired);
    },
    async ready() {
      if (mode === "active") await Promise.all(sources.map((source) => source.query.read()));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopInitial();
      initial.dispose();
      for (const source of sources) {
        source.stop?.();
        source.query.dispose();
      }
      sources.length = 0;
    },
  };
};
