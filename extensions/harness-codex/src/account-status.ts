import { createAppServerRpc } from "./app-server-rpc";
import { serverEnvironment } from "./app-server-transport";
import { defaultSpawnProcess, type SpawnDeps } from "./codex-process";

export const readCodexAccount = async (deps: SpawnDeps = { spawnProcess: defaultSpawnProcess }) => {
  const child = deps.spawnProcess(["app-server", "--listen", "stdio://"], { env: serverEnvironment() });
  const rpc = createAppServerRpc(child, () => {});
  const signal = AbortSignal.timeout(3_000);
  try {
    await rpc.request(
      "initialize",
      { clientInfo: { name: "pstdio", version: "1" }, capabilities: { experimentalApi: true } },
      undefined,
      signal,
    );
    rpc.write({ method: "initialized" });
    const result = (await rpc.request("account/read", { refreshToken: false }, undefined, signal)) as {
      account: null | { type: string; usesCodexManagedCredentials?: boolean };
      requiresOpenaiAuth: boolean;
    };
    return result;
  } finally {
    child.kill();
    await Promise.all([child.onExit, rpc.finished.catch(() => {})]);
  }
};
