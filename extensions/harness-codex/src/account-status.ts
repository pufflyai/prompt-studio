import { createAppServerRpc } from "./app-server-rpc";
import { serverEnvironment } from "./app-server-transport";
import { defaultSpawnProcess, type SpawnDeps } from "./codex-process";

export const readCodexAccountRequest = async <T>(
  method: string,
  params: Record<string, unknown>,
  deps: SpawnDeps = { spawnProcess: defaultSpawnProcess },
  parentSignal?: AbortSignal,
) => {
  const signal = AbortSignal.any([AbortSignal.timeout(3_000), ...(parentSignal ? [parentSignal] : [])]);
  signal.throwIfAborted();
  const child = deps.spawnProcess(["app-server", "--listen", "stdio://"], { env: serverEnvironment() });
  const rpc = createAppServerRpc(child, () => {});
  const finished = rpc.finished.catch(() => {});
  try {
    await rpc.request(
      "initialize",
      { clientInfo: { name: "pstdio", version: "1" }, capabilities: { experimentalApi: true } },
      undefined,
      signal,
    );
    rpc.write({ method: "initialized" });
    return (await rpc.request(method, params, undefined, signal)) as T;
  } finally {
    child.kill();
    await Promise.all([child.onExit, finished]);
  }
};

export const readCodexAccount = (deps?: SpawnDeps) =>
  readCodexAccountRequest<{
    account: null | { type: string; usesCodexManagedCredentials?: boolean };
    requiresOpenaiAuth: boolean;
  }>("account/read", { refreshToken: false }, deps);
