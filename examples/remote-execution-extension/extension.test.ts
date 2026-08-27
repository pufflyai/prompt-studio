import { describe, expect, test } from "bun:test";
import extension from "./extension";

const remoteWorkspace = {
  workspaceId: "workspace-1",
  executionKind: "remote",
  executionTarget: {
    kind: "remote",
    providerId: "example.remote-execution.workspace-type.remote",
    providerRef: { version: 1, data: { remoteId: "remote-workspace-1" } },
  },
} as const;

const events = {
  push: () => {},
};

const harness = extension.harnesses?.[0];
if (!harness) throw new Error("Remote harness is not defined.");
const provider = extension.workspaceTypes?.[0];
if (!provider) throw new Error("Remote workspace provider is not defined.");

describe("remote execution example workspace provider", () => {
  test("rejects a failed remote lifecycle response", async () => {
    const ctx = {
      connections: {
        async request() {
          return { status: 500, headers: {}, body: { error: "remote delete failed" } };
        },
      },
    };

    await expect(
      provider.delete?.(ctx as never, {
        operationId: "delete-1",
        projectId: "project-1",
        workspaceId: "workspace-1",
        providerRef: remoteWorkspace.executionTarget.providerRef,
      }),
    ).rejects.toThrow("HTTP 500");
  });
});

describe("remote execution example harness", () => {
  test("streams neutral message patches into the host event sink", async () => {
    const patches: unknown[] = [];
    const encoder = new TextEncoder();
    const ctx = {
      connections: {
        async request() {
          return { status: 200, headers: {}, body: { id: "agent-session-1", status: "completed" } };
        },
        async *stream() {
          yield { type: "response" as const, status: 200, headers: {} };
          yield {
            type: "data" as const,
            data: encoder.encode(
              `${JSON.stringify({ op: "add", path: "/messages/0", value: { role: "assistant", parts: [] } })}\n`,
            ),
          };
          yield { type: "end" as const };
        },
      },
    };

    const session = await harness.reattach?.(ctx as never, {
      agentSessionId: "agent-session-1",
      sessionId: "host-session-1",
      workspace: remoteWorkspace,
      events: { push: (patch) => patches.push(patch) },
    });
    await session?.done;

    expect(patches).toEqual([{ op: "add", path: "/messages/0", value: { role: "assistant", parts: [] } }]);
  });

  test("sends one follow-up prompt before polling the resumed session", async () => {
    const requests: Array<{ connectionId: string; input: Record<string, unknown> }> = [];
    const ctx = {
      connections: {
        async request(connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push({ connectionId, input: visibleInput });
          return {
            status: 200,
            headers: {},
            body: input.method === "GET" ? { id: "agent-session-1", status: "completed" } : null,
          };
        },
        async *stream(connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push({ connectionId, input: visibleInput });
          yield { type: "end" as const };
        },
      },
    };

    const session = await harness.resume(ctx as never, {
      agentSessionId: "agent-session-1",
      prompt: "Continue the remote task",
      sessionId: "host-session-1",
      workspace: remoteWorkspace,
      events,
    });
    await session.done;

    expect(requests).toEqual([
      {
        connectionId: "control-plane",
        input: {
          method: "POST",
          path: "/v1/sessions/agent-session-1/follow-ups",
          body: {
            hostSessionId: "host-session-1",
            requestId: "host-session-1:0",
            prompt: "Continue the remote task",
          },
        },
      },
      {
        connectionId: "control-plane",
        input: { method: "GET", path: "/v1/sessions/agent-session-1/events" },
      },
      {
        connectionId: "control-plane",
        input: { method: "GET", path: "/v1/sessions/agent-session-1" },
      },
    ]);
  });

  test("advertises restart-safe reattachment without replaying a prompt", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const ctx = {
      connections: {
        async request(_connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push(visibleInput);
          return { status: 200, headers: {}, body: { id: "agent-session-1", status: "completed" } };
        },
        async *stream(_connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push(visibleInput);
          yield { type: "end" as const };
        },
      },
    };

    expect(await harness.capabilities()).toContain("SessionReattach");
    const session = await harness.reattach?.(ctx as never, {
      agentSessionId: "agent-session-1",
      sessionId: "host-session-1",
      workspace: remoteWorkspace,
      events,
    });
    await session?.done;

    expect(requests).toEqual([
      { method: "GET", path: "/v1/sessions/agent-session-1/events" },
      { method: "GET", path: "/v1/sessions/agent-session-1" },
    ]);
  });

  test("stops local polling even when remote session deletion fails", async () => {
    let pollSignal: AbortSignal | undefined;
    const ctx = {
      connections: {
        async request(_connectionId: string, input: { method: string; signal?: AbortSignal }) {
          if (input.method === "DELETE") throw new Error("control plane unavailable");
          return { status: 200, headers: {}, body: { id: "agent-session-1", status: "running" } };
        },
        async *stream(_connectionId: string, input: { signal?: AbortSignal }) {
          pollSignal = input.signal;
          await new Promise((_resolve, reject) =>
            input.signal?.addEventListener("abort", () => reject(input.signal?.reason), { once: true }),
          );
        },
      },
    };
    const session = await harness.reattach?.(ctx as never, {
      agentSessionId: "agent-session-1",
      sessionId: "host-session-1",
      workspace: remoteWorkspace,
      events,
    });
    await Bun.sleep(0);

    await expect(session?.stop()).rejects.toThrow("control plane unavailable");
    expect(pollSignal?.aborted).toBe(true);
    expect(await session?.done).toEqual({ status: "cancelled" });
  });
});

describe("remote execution example ambiguous mutations", () => {
  test("cleans up an ambiguously accepted start with the stable host session id", async () => {
    const controller = new AbortController();
    const requests: Array<Record<string, unknown>> = [];
    const ctx = {
      connections: {
        async request(_connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push(visibleInput);
          if (input.method === "POST") {
            controller.abort(new DOMException("cancelled", "AbortError"));
            throw controller.signal.reason;
          }
          return { status: 204, headers: {}, body: null };
        },
      },
    };

    await expect(
      harness.start(ctx as never, {
        prompt: "Start remote work",
        sessionId: "host-session-ambiguous",
        workspace: remoteWorkspace,
        events,
        signal: controller.signal,
      }),
    ).rejects.toThrow();

    expect(requests).toEqual([
      {
        method: "POST",
        path: "/v1/workspaces/remote-workspace-1/sessions",
        body: { id: "host-session-ambiguous", prompt: "Start remote work" },
      },
      { method: "DELETE", path: "/v1/sessions/host-session-ambiguous" },
    ]);
  });

  test("cleans up an ambiguously accepted follow-up with the known remote session id", async () => {
    const controller = new AbortController();
    const requests: Array<Record<string, unknown>> = [];
    const ctx = {
      connections: {
        async request(_connectionId: string, input: Record<string, unknown>) {
          const { signal: _signal, ...visibleInput } = input;
          requests.push(visibleInput);
          if (input.method === "POST") {
            controller.abort(new DOMException("cancelled", "AbortError"));
            throw controller.signal.reason;
          }
          return { status: 204, headers: {}, body: null };
        },
      },
    };

    await expect(
      harness.resume(ctx as never, {
        agentSessionId: "agent-session-ambiguous",
        prompt: "Continue remote work",
        sessionId: "host-session-1",
        messageOffset: 4,
        workspace: remoteWorkspace,
        events,
        signal: controller.signal,
      }),
    ).rejects.toThrow();

    expect(requests).toEqual([
      {
        method: "POST",
        path: "/v1/sessions/agent-session-ambiguous/follow-ups",
        body: {
          hostSessionId: "host-session-1",
          requestId: "host-session-1:4",
          prompt: "Continue remote work",
        },
      },
      { method: "DELETE", path: "/v1/sessions/agent-session-ambiguous" },
    ]);
  });

  test("cleans up an ambiguous start after a transport failure without caller cancellation", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const ctx = {
      connections: {
        async request(_connectionId: string, input: Record<string, unknown>) {
          requests.push(input);
          if (input.method === "POST") throw new Error("connection reset after upload");
          return { status: 204, headers: {}, body: null };
        },
      },
    };

    await expect(
      harness.start(ctx as never, {
        prompt: "Start remote work",
        sessionId: "host-session-transport-failure",
        workspace: remoteWorkspace,
        events,
      }),
    ).rejects.toThrow("connection reset after upload");

    expect(requests.map(({ signal: _signal, ...request }) => request)).toEqual([
      {
        method: "POST",
        path: "/v1/workspaces/remote-workspace-1/sessions",
        body: { id: "host-session-transport-failure", prompt: "Start remote work" },
      },
      { method: "DELETE", path: "/v1/sessions/host-session-transport-failure" },
    ]);
  });

  test("cleans up an ambiguous follow-up after an HTTP failure", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const ctx = {
      connections: {
        async request(_connectionId: string, input: Record<string, unknown>) {
          requests.push(input);
          if (input.method === "POST") return { status: 502, headers: {}, body: null };
          return { status: 204, headers: {}, body: null };
        },
      },
    };

    await expect(
      harness.resume(ctx as never, {
        agentSessionId: "agent-session-http-failure",
        prompt: "Continue remote work",
        sessionId: "host-session-1",
        messageOffset: 4,
        workspace: remoteWorkspace,
        events,
      }),
    ).rejects.toThrow("HTTP 502");

    expect(requests.map(({ signal: _signal, ...request }) => request)).toEqual([
      expect.objectContaining({ method: "POST", path: "/v1/sessions/agent-session-http-failure/follow-ups" }),
      { method: "DELETE", path: "/v1/sessions/agent-session-http-failure" },
    ]);
  });
});
