import type { WorkbenchTerminalSessionAdapter, WorkbenchTerminalSessionModel } from "./terminal-controller-types";

const collectCleanupFailures = (errors: unknown[], effects: (() => void)[]) => {
  for (const effect of effects) {
    try {
      effect();
    } catch (error) {
      errors.push(error);
    }
  }
};

/** Coalesce reentrant kills and release every subscription/binding even when a host adapter fails. */
export const createTerminalSessionCleanup = (input: {
  adapters: Map<string, WorkbenchTerminalSessionAdapter>;
  sessions(): WorkbenchTerminalSessionModel[];
  patchKilled(id: string): void;
  cleanup(id: string): void;
}) => {
  const killings = new Map<string, Promise<void>>();
  let disposal: Promise<void> | undefined;
  const kill = (request: { sessionId: string; signal?: string }): Promise<void> => {
    const existing = killings.get(request.sessionId);
    if (existing) return existing;
    const settled = Promise.withResolvers<void>();
    killings.set(request.sessionId, settled.promise);
    const run = async () => {
      const errors: unknown[] = [];
      const adapter = input.adapters.get(request.sessionId);
      if (!adapter && !input.sessions().some((session) => session.id === request.sessionId))
        throw new Error(`Unknown terminal session: ${request.sessionId}`);
      try {
        await adapter?.kill(request.signal);
      } catch (error) {
        // A rejected user close keeps its adapter/binding available for retry. Final host teardown must release it.
        if (!disposal) throw error;
        errors.push(error);
      }
      collectCleanupFailures(errors, [
        () => input.patchKilled(request.sessionId),
        () => input.cleanup(request.sessionId),
      ]);
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, "Terminal cleanup failed");
    };
    void run().then(
      () => {
        killings.delete(request.sessionId);
        settled.resolve();
      },
      (error) => {
        killings.delete(request.sessionId);
        settled.reject(error);
      },
    );
    return settled.promise;
  };
  return {
    kill,
    dispose() {
      if (disposal) return disposal;
      const settled = Promise.withResolvers<void>();
      disposal = settled.promise;
      const run = async () => {
        const running = input.sessions().filter((session) => session.status === "running");
        const results = await Promise.allSettled(running.map((session) => kill({ sessionId: session.id })));
        const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
        for (const session of input.sessions()) {
          try {
            input.cleanup(session.id);
          } catch (error) {
            errors.push(error);
          }
        }
        input.adapters.clear();
        if (errors.length) throw new AggregateError(errors, "Terminal disposal failed");
      };
      void run().then(settled.resolve, settled.reject);
      return disposal;
    },
  };
};
