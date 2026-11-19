import { defineConnection, type ExtensionConnectionsApi, type JsonValue } from "@pstdio/sdk/extensions";

// The host keeps the controller URL and its finite machine key. The key never reaches
// extension settings, the repository or a remote environment.
export const connection = defineConnection({
  id: "pocketcoder",
  scope: "global",
  label: "PocketCoder remote tests",
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/templates", "/v1/workspaces"],
  check: { method: "GET", path: "/v1/templates?limit=1" },
});

export const templatePublisher = defineConnection({
  id: "branch-template-publisher",
  scope: "global",
  label: "PocketCoder branch templates",
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
