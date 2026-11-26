import { setTimeout as delay } from "node:timers/promises";
import { defineConnection, type ExtensionConnectionsApi, type JsonValue, l10n } from "@pstdio/sdk/extensions";

// The host keeps the controller URL and its finite machine key. The key never reaches
// extension settings, the repository or a remote environment.
export const connection = defineConnection({
  id: "pocketcoder",
  scope: "global",
  label: l10n("remote-testing.pocketcoder-remote-tests", "PocketCoder remote tests"),
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/templates", "/v1/workspaces", "/v1/kito-workflow"],
  check: { method: "GET", path: "/v1/templates?limit=1" },
});

export const templatePublisher = defineConnection({
  id: "branch-template-publisher",
  scope: "global",
  label: l10n("remote-testing.pocketcoder-branch-templates", "PocketCoder branch templates"),
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["POST"],
  allowedPathPrefixes: ["/v1/templates"],
});

export type Api = <T>(input: {
  method: "GET" | "POST";
  path: string;
  body?: JsonValue;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}) => Promise<T>;

export class PocketCoderError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(`PocketCoder HTTP ${status}: ${message}`);
  }
}

export function connectionApi(connections: ExtensionConnectionsApi, id = connection.id): Api {
  return async (input) => {
    const response = await connections.request(id, input);
    if (response.status < 200 || response.status >= 300) {
      const error = response.body as { error?: { message?: string; code?: string } } | null;
      throw new PocketCoderError(response.status, error?.error?.message ?? "Request failed.", error?.error?.code);
    }
    return response.body as never;
  };
}

export async function waitForControllerPoll(signal?: AbortSignal) {
  try {
    await delay(3000, undefined, { signal });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
}

export function canRetryControllerRequest(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  return !(
    (typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status < 500 &&
      ![408, 429].includes(status)) ||
    error instanceof SyntaxError ||
    (error && typeof error === "object" && "name" in error && error.name === "AbortError")
  );
}

// Receipt reads are safe to repeat. Keep accepted runs alive across transport outages.
export async function readControllerWithRetry<T>(api: Api, path: string, signal?: AbortSignal): Promise<T> {
  while (true) {
    signal?.throwIfAborted();
    try {
      return await api<T>({ method: "GET", path, signal });
    } catch (error) {
      signal?.throwIfAborted();
      if (!canRetryControllerRequest(error)) throw error;
    }
    await waitForControllerPoll(signal);
  }
}
