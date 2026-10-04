import { createCodexWorker } from "./app-server-worker";
import { defaultSpawnProcess, type SpawnDeps } from "./codex-process";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";
export const createCodexRuntime = (deps: SpawnDeps = { spawnProcess: defaultSpawnProcess }) => {
  const workers = new Map<string, ReturnType<typeof createCodexWorker>>();
  const readers = new Map<ReturnType<typeof createCodexWorker>, string | undefined>();
  const disposeMatching = async (matches: (key: string) => boolean) => {
    const selected = [...workers.entries()].filter(([key]) => matches(key));
    for (const [key] of selected) workers.delete(key);
    const transient = [...readers.entries()].filter(([, projectId]) => matches(JSON.stringify([projectId])));
    for (const [reader] of transient) readers.delete(reader);
    await Promise.all([
      ...selected.map(([, owned]) => owned.dispose()),
      ...transient.map(([reader]) => reader.dispose()),
    ]);
  };
  const keyOf = (input: StartSpawnInput & Partial<ResumeSpawnInput>) =>
    JSON.stringify([input.env?.PSTDIO_PROJECT_ID, input.env?.PSTDIO_SESSION_ID ?? input.agentSessionId, input.cwd]);
  const worker = (input: StartSpawnInput & Partial<ResumeSpawnInput>) => {
    input.signal?.throwIfAborted();
    const key = keyOf(input);
    let owned = workers.get(key);
    if (!owned || owned.isClosed()) {
      owned = createCodexWorker(input, deps);
      workers.set(key, owned);
    }
    return owned;
  };
  return {
    worker,
    readMessages: async (input: { agentSessionId: string; cwd?: string; env?: Record<string, string> }) => {
      const live = [...workers.entries()].find(
        ([key, owned]) =>
          JSON.parse(key)[0] === (input.env?.PSTDIO_PROJECT_ID ?? null) &&
          JSON.parse(key)[2] === (input.cwd ?? null) &&
          !owned.isClosed() &&
          owned.threadId() === input.agentSessionId,
      )?.[1];
      if (live) return live.readMessages(input.agentSessionId);
      const reader = createCodexWorker(
        { ...input, prompt: "", events: { getMessages: () => [], push: () => {} } },
        deps,
      );
      readers.set(reader, input.env?.PSTDIO_PROJECT_ID);
      try {
        return await reader.readMessages(input.agentSessionId);
      } finally {
        readers.delete(reader);
        await reader.dispose();
      }
    },
    run: (
      input: StartSpawnInput & Partial<ResumeSpawnInput>,
      command?: { method: string; params: Record<string, unknown>; goal?: boolean },
    ) => worker(input).run(input, command),
    dispose: () => disposeMatching(() => true),
    disposeScope: (projectId?: string) => disposeMatching((key) => JSON.parse(key)[0] === (projectId ?? null)),
  };
};
