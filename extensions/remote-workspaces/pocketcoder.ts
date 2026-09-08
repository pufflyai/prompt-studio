import { defineConnection, type ExtensionConnectionsApi, l10n } from "@pstdio/sdk/extensions";

export const pocketCoder = defineConnection({
  id: "pocketcoder",
  label: l10n("connections.pocketcoder", "PocketCoder"),
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/templates", "/v1/workspaces"],
  check: { method: "GET", path: "/v1/templates" },
});

export interface PocketCoderWorkspace {
  id: string;
  state:
    | "queued"
    | "provisioning"
    | "connected"
    | "ready"
    | "preserving"
    | "terminating"
    | "succeeded"
    | "failed"
    | "canceled"
    | "expired"
    | "preserved";
  change_cursor: number;
  reason_code: string | null;
  failure: { reason_code: string; log_tail: string } | null;
}

export type PocketCoderContext = { connections: ExtensionConnectionsApi };

export class PocketCoderError extends Error {
  constructor(
    readonly status: number,
    body: unknown,
  ) {
    const detail = body as { error?: { message?: string } } | null;
    super(`PocketCoder HTTP ${status}${detail?.error?.message ? `: ${detail.error.message}` : "."}`);
  }
}

export const request = async <T>(ctx: PocketCoderContext, input: Parameters<ExtensionConnectionsApi["request"]>[1]) => {
  const response = await ctx.connections.request<T>(pocketCoder.id, input);
  if (response.status < 200 || response.status >= 300) throw new PocketCoderError(response.status, response.body);
  return response.body;
};

export const workspacePath = (id: string) => `/v1/workspaces/${encodeURIComponent(id)}`;

export const getWorkspace = (ctx: PocketCoderContext, id: string, signal?: AbortSignal) =>
  request<PocketCoderWorkspace>(ctx, { method: "GET", path: workspacePath(id), signal });

export const cancelWorkspace = (ctx: PocketCoderContext, id: string) =>
  request<PocketCoderWorkspace>(ctx, { method: "POST", path: `${workspacePath(id)}/cancel` });

export const isTerminal = (workspace: PocketCoderWorkspace) =>
  ["succeeded", "failed", "canceled", "expired", "preserved"].includes(workspace.state);

export const wait = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, 1_000);
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
  });
