import type { HarnessContext, HarnessSession } from "@pstdio/sdk/extensions";
import { createHarnessServerStore } from "./opencode-server";
import { createOpencodeService } from "./opencode-service";

type Scope = {
  abort: AbortController;
  pending: Set<Promise<unknown>>;
  sessions: Set<HarnessSession>;
};

export const createOpencodeHarnessService = (overrides: Parameters<typeof createOpencodeService>[0] = {}) => {
  const scopes = new Map<HarnessContext, Scope>();
  const retired = new WeakSet<HarnessContext>();
  let service: Promise<ReturnType<typeof createOpencodeService>> | undefined;
  let closing = Promise.resolve();

  const scopeFor = (ctx: HarnessContext) => {
    if (retired.has(ctx)) throw new Error("OpenCode project context has been disposed.");
    let scope = scopes.get(ctx);
    if (!scope) {
      scope = { abort: new AbortController(), pending: new Set(), sessions: new Set() };
      scopes.set(ctx, scope);
    }
    return scope;
  };

  return {
    run: <T>(ctx: HarnessContext, action: (signal: AbortSignal) => Promise<T>) => {
      const scope = scopeFor(ctx);
      const pending = Promise.resolve().then(() => {
        scope.abort.signal.throwIfAborted();
        return action(scope.abort.signal);
      });
      scope.pending.add(pending);
      const release = () => {
        scope.pending.delete(pending);
      };
      void pending.then(release, release);
      return pending;
    },
    track: async (ctx: HarnessContext, session: HarnessSession) => {
      if (retired.has(ctx)) {
        await session.stop();
        throw new Error("OpenCode project context has been disposed.");
      }
      const scope = scopeFor(ctx);
      scope.sessions.add(session);
      const release = () => {
        scope.sessions.delete(session);
      };
      void session.done.then(release, release);
      return session;
    },
    get: async (ctx: HarnessContext) => {
      scopeFor(ctx);
      service ??= closing.then(() =>
        createOpencodeService({
          ...overrides,
          serverStore: overrides.serverStore ?? createHarnessServerStore(ctx.state),
        }),
      );
      return service;
    },
    dispose: async (ctx: HarnessContext) => {
      retired.add(ctx);
      const scope = scopes.get(ctx);
      scope?.abort.abort();
      if (service) {
        const current = await service;
        if ([...scopes.keys()].every((consumer) => retired.has(consumer))) current.cancelPendingStartup();
      }
      // Pending native creation still needs this connection to abort a late session.
      await Promise.allSettled([...(scope?.pending ?? [])]);
      const stopped = await Promise.allSettled([...(scope?.sessions ?? [])].map((session) => session.stop()));
      scopes.delete(ctx);
      if (!scopes.size && service) {
        const owned = service;
        service = undefined;
        closing = owned.then((value) => value.dispose());
      }
      await closing;
      const errors = stopped.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "OpenCode session cleanup failed.");
    },
  };
};
