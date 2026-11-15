import { type CommandContext, createScopedQueryClient, type SessionMetadataChange } from "@pstdio/sdk/extensions";
import { nativeSubmissionObservationId } from "./native-submission";
import { readSessionSnapshot } from "./snapshot";

export const createSessionMetadataQuery = (
  ctx: CommandContext,
  id: string,
  clocks: () => { queue: number; run: number },
) => {
  const root = createScopedQueryClient({
    runtimeId: ctx.invocationId,
    projectId: ctx.projectId,
    extensionId: ctx.extensionId,
  });
  let previous: Awaited<ReturnType<typeof readSessionSnapshot>>["reads"] | undefined;
  const changes = new Map<string, number>([["session", 0]]);
  let revision = 0;
  let ready = Promise.resolve();
  const query = root.query({
    id: "session.metadata",
    resourceKey: id,
    subscribe(invalidate) {
      const controller = new AbortController();
      const signal = AbortSignal.any([ctx.signal, controller.signal]);
      const changed = (field: SessionMetadataChange | "storage") => {
        changes.set(field, ++revision);
        invalidate();
      };
      // The host subscribes before resolving link/provider owners. Await it before the finite read.
      const observation = ctx.sessions.observeMetadata(id, changed, { signal });
      ready = observation.then(() => {});
      const storage = ctx.storage.observe(() => changed("storage"), {
        recordIds: [nativeSubmissionObservationId(ctx, id)],
        signal,
      });
      return () => {
        controller.abort();
        storage.close();
        void observation.then(
          (watch) => watch.close(),
          () => {},
        );
      };
    },
    async read(signal) {
      await ready;
      signal.throwIfAborted();
      const marks = [...changes];
      const changed = new Set(changes.keys());
      const readAt = clocks();
      const result = await readSessionSnapshot(ctx, id, undefined, { messages: false, previous, changes: changed });
      signal.throwIfAborted();
      return { ...result, readAt, marks };
    },
  });
  return {
    query,
    accepted(
      result: NonNullable<ReturnType<typeof query.getSnapshot>["data"]>,
      queued: NonNullable<typeof previous>["queued"],
    ) {
      previous = { ...result.reads, queued };
      for (const [field, mark] of result.marks) if (changes.get(field) === mark) changes.delete(field);
    },
    refreshQueue() {
      changes.set("queue", ++revision);
      query.invalidate();
    },
    dispose: root.dispose,
  };
};
