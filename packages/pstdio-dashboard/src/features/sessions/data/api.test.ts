import { afterEach, describe, expect, it } from "bun:test";
import { stopSession } from "./api";
import type { SessionDto } from "./mappers";

const RUNTIME_CONFIG_KEY = "__PSTDIO_CONFIG__";

type RuntimeConfigWindow = {
  [RUNTIME_CONFIG_KEY]?: {
    apiBaseUrl?: string;
    version?: string;
  };
};

const originalFetch = globalThis.fetch;

const toUrl = (input: URL | RequestInfo) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

describe("stopSession", () => {
  afterEach(() => {
    delete (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY];
    globalThis.fetch = originalFetch;
  });

  it("marks the session as cancelled", async () => {
    (globalThis as RuntimeConfigWindow)[RUNTIME_CONFIG_KEY] = { apiBaseUrl: "http://localhost:19840" };

    const calls: Array<{ body: unknown; method: string; url: string }> = [];
    const cancelledSession: SessionDto = {
      id: "session-1",
      project_id: "project-1",
      agent_session_id: "agent-session-1",
      title: "Build feature",
      status: "cancelled",
      archived: false,
      agent: "opencode",
      last_selected_model: "openai/gpt-5.5",
      created_at: "2026-04-24T12:00:00.000Z",
      updated_at: "2026-04-24T12:01:00.000Z",
    };
    const fetchMock = Object.assign(
      async (input: URL | RequestInfo, init?: RequestInit | BunFetchRequestInit) => {
        const method = init?.method ?? "GET";
        const url = toUrl(input);
        calls.push({ body: init?.body ? JSON.parse(init.body as string) : null, method, url });

        if (method === "PATCH" && url.endsWith("/v1/sessions/session-1/status")) {
          return new Response(JSON.stringify(cancelledSession), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        throw new Error(`Unexpected request: ${method} ${url}`);
      },
      { preconnect: originalFetch.preconnect?.bind(originalFetch) },
    ) as typeof fetch;
    globalThis.fetch = fetchMock;

    const session = await stopSession("session-1");

    expect(calls).toEqual([
      {
        body: { status: "cancelled" },
        method: "PATCH",
        url: "http://localhost:19840/v1/sessions/session-1/status",
      },
    ]);
    expect(session).toEqual(cancelledSession);
  });
});
