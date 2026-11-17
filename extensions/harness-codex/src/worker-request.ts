import type { createAppServerTransport } from "./app-server-transport";
import type { ResumeSpawnInput, StartSpawnInput } from "./session-input";
import { stopNativeThread } from "./stop-native-thread";

export const createCodexWorkerRequest =
  (input: {
    rpc: ReturnType<typeof createAppServerTransport>;
    initial: StartSpawnInput;
    pending: Set<Promise<unknown>>;
    track: <T>(work: Promise<T>) => Promise<T>;
    load: (run: StartSpawnInput & Partial<ResumeSpawnInput>) => Promise<string>;
    closed: () => boolean;
    signal: AbortSignal;
    threadId: () => string | undefined;
    nativeTurn: () => Promise<string | undefined>;
  }) =>
  (method: string, params: Record<string, unknown>, signal?: AbortSignal) => {
    const previous = [...input.pending];
    return input.track(
      (async () => {
        signal?.throwIfAborted();
        await input.rpc.ready;
        const readOnly = ["thread/read", "thread/turns/list", "thread/goal/get", "config/read"].includes(method);
        if (!readOnly) await Promise.allSettled(previous);
        if (!readOnly && params.threadId)
          await input.load({
            ...input.initial,
            signal,
            agentSessionId: String(params.threadId),
            model: undefined,
            params: undefined,
          });
        signal?.throwIfAborted();
        if (input.closed()) throw new Error("Codex owner disposed.");
        const readSignal = signal ? AbortSignal.any([signal, input.signal]) : input.signal;
        const result = await input.rpc.request(method, params, undefined, readOnly ? readSignal : undefined);
        const id = input.threadId();
        if (!readOnly && signal?.aborted && id) await stopNativeThread(input.rpc, id, input.nativeTurn);
        signal?.throwIfAborted();
        return result;
      })(),
    );
  };
