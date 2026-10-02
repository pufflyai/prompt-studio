import { createInterface } from "node:readline";
import type { SpawnDeps } from "./codex-process";

export interface RpcMessage {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
}

const parseMessage = (line: string) => {
  try {
    const message = JSON.parse(line) as RpcMessage;
    return message && typeof message === "object" ? message : undefined;
  } catch {
    return undefined;
  }
};

export const createAppServerRpc = (
  child: ReturnType<SpawnDeps["spawnProcess"]>,
  onMessage: (message: RpcMessage) => void,
) => {
  let nextId = 1;
  let closed = false;
  const requests = new Map<string | number, ReturnType<typeof Promise.withResolvers<unknown>>>();
  const close = () => {
    closed = true;
    for (const request of requests.values()) request.reject(new Error("Codex app-server connection closed."));
    requests.clear();
  };
  const write = (message: RpcMessage) => {
    if (closed) throw new Error("Codex app-server connection closed.");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (method: string, params: Record<string, unknown>) => {
    const id = nextId++;
    const pending = Promise.withResolvers<unknown>();
    requests.set(id, pending);
    try {
      write({ id, method, params });
    } catch (error) {
      requests.delete(id);
      pending.reject(error);
    }
    return pending.promise;
  };
  const reader = createInterface({ input: child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
  const finished = new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => {
      reject(error);
      close();
      reader.close();
    };
    child.stdout.on("error", fail);
    child.stdout.once("close", () => reader.close());
    child.stdin.on("error", fail);
    reader.on("error", fail);
    reader.once("close", () => {
      close();
      resolve();
    });
    reader.on("line", (line) => {
      if (closed) return;
      try {
        const message = parseMessage(line);
        if (!message) return;
        if (!message.method && message.id !== undefined) {
          const pending = requests.get(message.id);
          requests.delete(message.id);
          if (message.error) pending?.reject(new Error(message.error.message ?? "Codex request failed."));
          else pending?.resolve(message.result);
        } else if (message.method) onMessage(message);
      } catch (error) {
        fail(error);
      }
    });
  });
  child.onExit.then(close);
  child.stderr.resume();
  return { request, write, finished };
};
