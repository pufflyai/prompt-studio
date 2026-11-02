import { createAppServerTransport, serverEnvironment } from "./app-server-transport";
import { createCodexWorker } from "./app-server-worker";
import { defaultSpawnProcess, resolveCodexCommand, type SpawnDeps } from "./codex-process";
import { nativeThreadMessages } from "./native-history";
import type { Turn } from "./protocol/v2/Turn";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";

type ThreadInput = { agentSessionId: string; cwd?: string; env?: Record<string, string> };

export const createCodexRuntime = (deps: SpawnDeps = { spawnProcess: defaultSpawnProcess }) => {
  let authenticationGeneration = 0;
  const servers = new Map<string, ReturnType<typeof createAppServerTransport>>();
  const workers = new Map<
    string,
    { projectId?: string; sessionId?: string; stale?: boolean; worker: ReturnType<typeof createCodexWorker> }
  >();
  const readers = new Map<AbortController, { projectId?: string; done: Promise<void> }>();
  const disposeReaders = async (projectId?: string, all = false) => {
    const selected = [...readers.entries()].filter(([, value]) => all || value.projectId === projectId);
    for (const [controller] of selected) controller.abort(new Error("Codex history scope disposed."));
    await Promise.all(selected.map(([, value]) => value.done));
  };
  const serverKey = (env?: Record<string, string>) =>
    JSON.stringify([
      resolveCodexCommand({ which: (name) => Bun.which(name, { PATH: env?.PATH ?? process.env.PATH }) }),
      Object.entries(serverEnvironment(env)).sort(([a], [b]) => a.localeCompare(b)),
    ]);
  const server = (env?: Record<string, string>) => {
    const key = JSON.stringify([serverKey(env), authenticationGeneration]);
    let transport = servers.get(key);
    if (!transport || transport.isClosed()) {
      transport = createAppServerTransport(serverEnvironment(env), deps);
      servers.set(key, transport);
    }
    return transport;
  };
  const identity = (input: Pick<StartSpawnInput & Partial<ResumeSpawnInput>, "env" | "agentSessionId">) =>
    JSON.stringify([input.env?.PSTDIO_PROJECT_ID, input.env?.PSTDIO_SESSION_ID ?? input.agentSessionId]);
  const keyOf = (input: Pick<StartSpawnInput & Partial<ResumeSpawnInput>, "env" | "agentSessionId" | "cwd">) =>
    JSON.stringify([serverKey(input.env), identity(input)]);
  const worker = (input: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    input.signal?.throwIfAborted();
    const key = keyOf(input);
    let owned = workers.get(key)?.worker;
    if (!owned || owned.isClosed()) {
      owned = createCodexWorker(input, server(input.env), identity(input));
      workers.set(key, {
        projectId: input.env?.PSTDIO_PROJECT_ID,
        sessionId: input.env?.PSTDIO_SESSION_ID,
        worker: owned,
      });
    }
    return owned;
  };
  const releaseStale = async (key: string, value: NonNullable<ReturnType<typeof workers.get>>) => {
    if (value.stale && (await value.worker.releaseIdle()) && workers.get(key) === value) workers.delete(key);
  };
  const withReader = async <T>(
    input: ThreadInput,
    read: (transport: ReturnType<typeof createAppServerTransport>, signal: AbortSignal) => Promise<T>,
  ) => {
    const transport = server(input.env);
    const reader = { receive: () => {}, disconnect: () => {} };
    const controller = new AbortController();
    const completion = Promise.withResolvers<void>();
    readers.set(controller, { projectId: input.env?.PSTDIO_PROJECT_ID, done: completion.promise });
    transport.retain(reader);
    try {
      await transport.ready;
      return await read(transport, controller.signal);
    } finally {
      try {
        await transport.release(reader);
      } finally {
        readers.delete(controller);
        completion.resolve();
      }
    }
  };
  return {
    worker,
    refreshAuthentication: async () => {
      authenticationGeneration++;
      // Native login has already finished. Retire old owners at their next invocation so an
      // unresponsive app-server cannot hold account setup open or interrupt another active goal.
      for (const value of workers.values()) value.stale = true;
      for (const [key, transport] of servers) if (transport.isClosed()) servers.delete(key);
    },
    releaseSession: async (projectId: string | undefined, sessionId: string) => {
      const selected = [...workers].filter(
        ([, value]) => value.projectId === projectId && value.sessionId === sessionId,
      );
      const released = await Promise.allSettled(
        selected.map(async ([key, value]) => {
          if (!(await value.worker.releaseIdle())) return false;
          if (workers.get(key) === value) workers.delete(key);
          return true;
        }),
      );
      const errors = released.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
      if (errors.length) throw new AggregateError(errors, "Codex session cleanup failed.");
      return released.every((result) => result.status === "fulfilled" && result.value);
    },
    prepareGoalUpdate: (input: Parameters<typeof keyOf>[0]) => workers.get(keyOf(input))?.worker.prepareGoalUpdate(),
    readMessages: (input: ThreadInput) =>
      withReader(input, async (transport, signal) => {
        const result = (await transport.request(
          "thread/read",
          {
            threadId: input.agentSessionId,
            includeTurns: true,
          },
          undefined,
          signal,
        )) as { thread: { turns: Turn[] } };
        return nativeThreadMessages(result.thread.turns);
      }),
    fork: (input: ThreadInput) =>
      withReader(input, (transport, signal) => {
        signal.throwIfAborted();
        // A native copy can finish after scope cancellation. Keep its reply owned so
        // the loaded fork is released even when the caller has already gone away.
        const copied = transport
          .request("thread/fork", {
            threadId: input.agentSessionId,
            deferGoalContinuation: true,
            ...(input.cwd ? { cwd: input.cwd } : {}),
          })
          .then(async (response) => {
            const result = response as { thread: { id: string } };
            await transport.request("thread/unsubscribe", { threadId: result.thread.id });
            return result.thread.id;
          });
        return new Promise<string>((resolve, reject) => {
          const abort = () => reject(signal.reason);
          const release = () => signal.removeEventListener("abort", abort);
          copied.then(
            (id) => {
              release();
              resolve(id);
            },
            (error) => {
              release();
              reject(error);
            },
          );
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        });
      }),
    run: (
      input: StartSpawnInput & Partial<ResumeSpawnInput>,
      command?: { method: string; params: Record<string, unknown>; goal?: boolean },
    ) => {
      const key = keyOf(input);
      const current = workers.get(key);
      // Existing turns keep their transport. The next idle invocation loads the new account.
      return (async () => {
        if (current) await releaseStale(key, current);
        if (workers.get(key)?.stale)
          throw new Error("Codex is still running work with the previous account. Stop or finish that work first.");
        return worker(input).run(input, command);
      })();
    },
    dispose: async () => {
      // Shutdown ends the entire provider generation, including any unanswered native requests.
      const owned = [...workers.values()];
      workers.clear();
      for (const { worker } of owned) worker.shutdown();
      await Promise.all([...servers.values()].map((transport) => transport.dispose()));
      await disposeReaders(undefined, true);
      await Promise.all(owned.map(({ worker }) => worker.dispose()));
      servers.clear();
    },
    disposeScope: async (projectId?: string) => {
      const selected = [...workers.entries()].filter(([, value]) => value.projectId === projectId);
      await disposeReaders(projectId);
      await Promise.all(
        selected.map(async ([key, value]) => {
          await value.worker.dispose();
          if (workers.get(key) === value) workers.delete(key);
        }),
      );
    },
  };
};
