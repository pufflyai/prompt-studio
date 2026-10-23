import { createAppServerRpc, type RpcMessage } from "./app-server-rpc";
import type { SpawnDeps } from "./codex-process";

interface Owner {
  receive: (message: RpcMessage) => void;
  disconnect: () => void;
}
const messageThread = (message: RpcMessage) =>
  message.params?.threadId ?? (message.params?.thread as { id?: string } | undefined)?.id;
export const serverEnvironment = (env?: Record<string, string>) => {
  const base = Object.fromEntries(
    Object.entries({ ...process.env, ...env }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete base.PSTDIO_SESSION_ID;
  delete base.PSTDIO_PROJECT_ID;
  return base;
};
export const createAppServerTransport = (env: Record<string, string>, deps: SpawnDeps) => {
  const child = deps.spawnProcess(
    [
      "app-server",
      "--listen",
      "stdio://",
      "--enable",
      "default_mode_request_user_input",
      "-c",
      "thread_unload_delay_secs=0",
    ],
    { env },
  );
  let closed = false;
  const owners = new Set<Owner>();
  const threads = new Map<string, { identity: string; owner?: Owner }>();
  const rpc = createAppServerRpc(child, (message) => {
    const id = messageThread(message);
    if (typeof id === "string") threads.get(id)?.owner?.receive(message);
  });
  const disconnect = () => {
    if (closed) return;
    closed = true;
    for (const owner of owners) owner.disconnect();
    child.kill();
  };
  child.onExit.then(disconnect);
  rpc.finished.then(disconnect, disconnect);
  const ready = rpc
    .request("initialize", {
      clientInfo: { name: "pstdio", version: "1" },
      capabilities: { experimentalApi: true },
    })
    .then(() => rpc.write({ method: "initialized" }));
  ready.catch(disconnect);
  return {
    ...rpc,
    ready,
    pid: child.pid,
    isClosed: () => closed,
    retain: (owner: Owner) => {
      owners.add(owner);
    },
    claim: (id: string, identity: string, owner: Owner) => {
      const previous = threads.get(id);
      if (previous && previous.identity !== identity)
        throw new Error("Native Codex thread belongs to a different host session.");
      if (previous?.owner && previous.owner !== owner) throw new Error("Native Codex thread already has an owner.");
      threads.set(id, { identity, owner });
    },
    release: async (owner: Owner) => {
      for (const [id, entry] of threads) {
        if (entry.owner !== owner) continue;
        try {
          if (!closed) await rpc.request("thread/unsubscribe", { threadId: id });
        } catch (error) {
          if (!closed) throw error;
        }
        entry.owner = undefined;
      }
      owners.delete(owner);
      if (!owners.size) {
        disconnect();
        await Promise.all([child.onExit, rpc.finished.catch(() => {})]);
      }
    },
    dispose: async () => {
      disconnect();
      await Promise.all([child.onExit, rpc.finished.catch(() => {})]);
    },
  };
};
