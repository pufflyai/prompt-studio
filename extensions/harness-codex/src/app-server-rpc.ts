import { StringDecoder } from "node:string_decoder";
import type { SpawnDeps } from "./codex-process";

export interface RpcMessage {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
}

export class CodexRequestRejectedError extends Error {}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  onResult?: (result: unknown) => void;
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
  const requests = new Map<string | number, PendingRequest>();
  const close = () => {
    closed = true;
    for (const request of requests.values()) request.reject(new Error("Codex app-server connection closed."));
    requests.clear();
  };
  const write = (message: RpcMessage) => {
    if (closed) throw new Error("Codex app-server connection closed.");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const request = (
    method: string,
    params: Record<string, unknown>,
    onResult?: (result: unknown) => void,
    signal?: AbortSignal,
  ) => {
    signal?.throwIfAborted();
    const id = nextId++;
    const pending = Promise.withResolvers<unknown>();
    requests.set(id, { ...pending, onResult });
    const abort = () => {
      requests.delete(id);
      pending.reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      write({ id, method, params });
    } catch (error) {
      requests.delete(id);
      pending.reject(error);
    }
    return pending.promise.finally(() => signal?.removeEventListener("abort", abort));
  };
  const settleResponse = (message: RpcMessage, pending: PendingRequest | undefined) => {
    if (!pending) return;
    if (message.error) {
      pending.reject(new CodexRequestRejectedError(message.error.message ?? "Codex request failed."));
      return;
    }
    try {
      // Apply state at its position in the native stream, before later notifications in this chunk.
      pending.onResult?.(message.result);
      pending.resolve(message.result);
    } catch (error) {
      pending.reject(error);
    }
  };
  const finished = new Promise<void>((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let fragments: string[] = [];
    const detach = () => {
      child.stdout.off("data", receive);
      child.stdout.off("end", finish);
      child.stdout.off("close", finish);
      fragments = [];
    };
    const fail = (error: unknown) => {
      reject(error);
      close();
      detach();
    };
    const line = (value: string) => {
      if (closed) return;
      try {
        const message = parseMessage(value);
        if (!message) return;
        if (!message.method && message.id !== undefined) {
          const pending = requests.get(message.id);
          requests.delete(message.id);
          settleResponse(message, pending);
        } else if (message.method) onMessage(message);
      } catch (error) {
        fail(error);
      }
    };
    const receive = (chunk: Buffer) => {
      const value = decoder.write(chunk);
      // Bun readline splits U+2028/U+2029 inside JSON strings; Codex frames only at LF (ADR 0154).
      // Search each decoded chunk once; a fragmented response must not rescan its growing prefix.
      let start = 0;
      let newline = value.indexOf("\n");
      while (!closed && newline >= 0) {
        fragments.push(value.slice(start, newline));
        const message = fragments.join("");
        fragments = [];
        start = newline + 1;
        line(message);
        newline = value.indexOf("\n", start);
      }
      if (!closed && start < value.length) fragments.push(value.slice(start));
    };
    const finish = () => {
      if (closed) return;
      line(fragments.join("") + decoder.end());
      close();
      detach();
      resolve();
    };
    child.stdout.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", receive);
    child.stdout.once("end", finish);
    child.stdout.once("close", finish);
  });
  child.stderr.resume();
  return { request, write, finished };
};
