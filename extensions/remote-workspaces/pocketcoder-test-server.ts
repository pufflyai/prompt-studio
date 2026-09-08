import type { ExtensionConnectionsApi, HarnessContext, JsonPatch } from "@pstdio/sdk/extensions";

export const workspaceId = "69325e11-ce89-4254-b4e5-a42a27614798";

export const workspaceResource = (state = "ready") => ({
  id: workspaceId,
  external_id: "host-workspace",
  template: { name: "pi-harness", version: "1", digest: "sha256:abc" },
  state,
  agent_state: "stable",
  change_cursor: 1,
  reason_code: null,
  failure: null,
});

export const remoteWorkspace = {
  workspaceId: "host-workspace",
  executionTarget: {
    kind: "remote" as const,
    providerId: "pstdio.remote-workspaces.workspace-type.remote",
    providerRef: { version: 1, data: { remoteId: workspaceId } },
  },
};

export const startPocketCoderTestServer = (handle: (request: Request) => Response | Promise<Response>) => {
  const requests: { method: string; path: string; body: unknown; idempotencyKey: string | null }[] = [];
  const patches: JsonPatch[] = [];
  const state = new Map<string, unknown>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: request.body ? await request.clone().json() : null,
        idempotencyKey: request.headers.get("Idempotency-Key"),
      });
      return handle(request);
    },
  });
  const connections: Pick<ExtensionConnectionsApi, "request"> = {
    async request<T>(_connectionId: string, input: Parameters<ExtensionConnectionsApi["request"]>[1]) {
      const response = await fetch(new URL(input.path, server.url), {
        method: input.method,
        headers: { "content-type": "application/json", ...input.headers },
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: input.signal,
      });
      const body = response.status === 204 ? null : await response.json();
      return { status: response.status, headers: Object.fromEntries(response.headers), body: body as T };
    },
  };
  return {
    requests,
    patches,
    ctx: {
      extensionId: "pstdio.remote-workspaces",
      connections,
      logger: { warn() {} },
      state: {
        async get<T>(key: string) {
          return state.get(key) as T | undefined;
        },
        async set(key: string, value: unknown) {
          state.set(key, structuredClone(value));
        },
        async delete(key: string) {
          state.delete(key);
        },
      },
    } as unknown as HarnessContext,
    events: { push: (patch: JsonPatch) => patches.push(patch) },
    stop: () => server.stop(true),
  };
};
