import { createAppServerTransport, serverEnvironment } from "./app-server-transport";
import { createCodexWorker } from "./app-server-worker";
import { defaultSpawnProcess, resolveCodexCommand, type SpawnDeps } from "./codex-process";
import { nativeThreadMessages } from "./native-history";
import type { Turn } from "./protocol/v2/Turn";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";

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
  return {
    worker,
    refreshAuthentication: async () => {
      authenticationGeneration++;
      const owned = [...workers.entries()];
      for (const [, value] of owned) value.stale = true;
      await Promise.all(owned.map(([key, value]) => releaseStale(key, value)));
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
    readMessages: async (input: { agentSessionId: string; cwd?: string; env?: Record<string, string> }) => {
      const transport = server(input.env);
      const reader = { receive: () => {}, disconnect: () => {} };
      const controller = new AbortController();
      const completion = Promise.withResolvers<void>();
      readers.set(controller, { projectId: input.env?.PSTDIO_PROJECT_ID, done: completion.promise });
      transport.retain(reader);
      try {
        await transport.ready;
        const result = (await transport.request(
          "thread/read",
          {
            threadId: input.agentSessionId,
            includeTurns: true,
          },
          undefined,
          controller.signal,
        )) as { thread: { turns: Turn[] } };
        return nativeThreadMessages(result.thread.turns);
      } finally {
        try {
          await transport.release(reader);
        } finally {
          readers.delete(controller);
          completion.resolve();
        }
      }
    },
    run: (
      input: StartSpawnInput & Partial<ResumeSpawnInput>,
      command?: { method: string; params: Record<string, unknown>; goal?: boolean },
    ) => {
      const key = keyOf(input);
      const current = workers.get(key);
      // Existing turns keep their transport. The next idle invocation loads the new account.
      return (async () => {
        if (current) await releaseStale(key, current);
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
