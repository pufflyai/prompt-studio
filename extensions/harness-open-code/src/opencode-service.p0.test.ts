import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptedPrompt, emptyMessages } from "./native-api.test-helpers";
import { createHarnessServerStore } from "./opencode-server";
import { createOpencodeService } from "./opencode-service";

let customHome: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

beforeEach(() => {
  customHome = mkdtempSync(join(tmpdir(), "harness-open-code-home-"));
  originalHome = process.env.HOME;
  originalUserProfile = process.env.USERPROFILE;
  process.env.HOME = customHome;
  process.env.USERPROFILE = customHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;

  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;

  rmSync(customHome, { recursive: true, force: true });
});

describe("request timeouts", () => {
  const noopServerStore = { read: async () => null, write: async () => {}, clear: async () => {} };

  test("POST timeout on cached URL does not retry the request", async () => {
    let postCalls = 0;
    const service = createOpencodeService({
      startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
      serverStore: { read: async () => "http://127.0.0.1:4900", write: async () => {}, clear: async () => {} },
      isPortOpen: async () => true,
      pingServer: async () => true,
      fetcher: async (input, init) => {
        const url = String(input);
        if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/api/session/session-1/prompt")) {
          postCalls++;
          throw new DOMException("The operation was aborted", "AbortError");
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const { messageComplete } = service.sendSessionMessage({
      sessionId: "session-1",
      prompt: "hello",
      cwd: "/repo",
    });

    await expect(messageComplete).rejects.toBeInstanceOf(DOMException);
    expect(postCalls).toBe(1);
  });

  test("connection failure on cached URL retries with a fresh server", async () => {
    let getCalls = 0;
    const service = createOpencodeService({
      startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
      serverStore: { read: async () => "http://127.0.0.1:4900", write: async () => {}, clear: async () => {} },
      isPortOpen: async () => true,
      pingServer: async () => true,
      fetcher: async (input, init) => {
        const url = String(input);
        if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });
        const method = init?.method ?? "GET";

        if (method === "GET" && url.includes("/api/session/")) {
          getCalls++;
          if (getCalls <= 1) {
            throw new TypeError("fetch failed");
          }
          return emptyMessages();
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const messages = await service.getSessionMessages("session-1", "/repo");
    expect(messages).toEqual([]);
    expect(getCalls).toBe(2);
  });

  test("POST timeout does not produce a terminal error", async () => {
    const service = createOpencodeService({
      startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
      serverStore: noopServerStore,
      isPortOpen: async () => false,
      pingServer: async () => false,
      fetcher: async (input, init) => {
        const url = String(input);
        if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/api/session?")) {
          return new Response(JSON.stringify({ data: { id: "session-1" } }));
        }

        if (method === "POST" && url.includes("/api/session/session-1/prompt")) {
          throw new DOMException("The operation was aborted", "AbortError");
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const result = await service.startSession({ prompt: "hello", cwd: "/repo" });
    // messageComplete rejects, but the error is a timeout — not a provider failure
    const error = await result.messageComplete.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
  });

  test("POST explicit HTTP error remains terminal", async () => {
    const service = createOpencodeService({
      startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
      serverStore: noopServerStore,
      isPortOpen: async () => false,
      pingServer: async () => false,
      fetcher: async (input, init) => {
        const url = String(input);
        if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/api/session?")) {
          return new Response(JSON.stringify({ data: { id: "session-1" } }));
        }

        if (method === "POST" && url.includes("/api/session/session-1/prompt")) {
          return new Response("Internal Server Error", { status: 500 });
        }

        throw new Error(`Unexpected: ${method} ${url}`);
      },
    });

    const result = await service.startSession({ prompt: "hello", cwd: "/repo" });
    // messageComplete should reject with the HTTP 500 error
    await expect(result.messageComplete).rejects.toThrow("500");
  });
});

test("fork copies the native session without submitting a prompt", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return Response.json({ id: "forked" });
    },
  });
  const service = createOpencodeService({
    startServer: async () => ({ url: server.url.origin, dispose: async () => {} }),
    serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  });
  try {
    expect(await service.forkSession("original", "/project")).toBe("forked");
    expect(requests).toEqual(["POST /session/original/fork"]);
  } finally {
    await service.dispose();
    server.stop(true);
  }
});

test("the harness server store persists through host state", async () => {
  const values = new Map<string, unknown>();
  const store = createHarnessServerStore({
    get: async (key) => values.get(key) as never,
    set: async (key, value) => void values.set(key, value),
    delete: async (key) => void values.delete(key),
  });
  const service = createOpencodeService({
    startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
    isPortOpen: async () => false,
    pingServer: async () => false,
    serverStore: store,
    fetcher: async (input) => {
      const url = String(input);
      if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });

      if (url.includes("/api/session?")) {
        return new Response(JSON.stringify({ data: { id: "session-1" } }));
      }

      if (url.includes("/api/session/session-1/prompt?")) {
        return acceptedPrompt();
      }

      throw new Error(`Unexpected request URL: ${url}`);
    },
  });

  await service.startSession({ prompt: "Start session", cwd: customHome });

  expect(await store.read()).toBe("http://127.0.0.1:4900");
});

test("startSession applies selected model to session creation and initial prompt message", async () => {
  const createBodies: unknown[] = [];
  const promptBodies: unknown[] = [];
  const service = createOpencodeService({
    startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
    serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
    isPortOpen: async () => false,
    pingServer: async () => false,
    fetcher: async (input, init) => {
      const url = String(input);
      if (/\/(?:wait|model)\b/.test(url)) return new Response(null, { status: 204 });
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/api/session?")) {
        createBodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: { id: "session-1" } }));
      }

      if (method === "POST" && url.includes("/api/session/session-1/prompt")) {
        promptBodies.push(JSON.parse(String(init?.body)));
        return acceptedPrompt();
      }

      throw new Error(`Unexpected: ${method} ${url}`);
    },
  });

  const result = await service.startSession({ prompt: "hello", cwd: "/repo", model: "openai/gpt-5.5" });
  await result.messageComplete;

  expect(createBodies).toEqual([
    {
      location: { directory: "/repo" },
      model: { providerID: "openai", id: "gpt-5.5" },
    },
  ]);
  expect(promptBodies).toEqual([
    {
      text: "hello",
    },
  ]);
});

test("startSession selects the thinking variant before admitting the initial prompt", async () => {
  const selections: unknown[] = [];
  const promptBodies: unknown[] = [];
  const service = createOpencodeService({
    startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
    serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
    isPortOpen: async () => false,
    pingServer: async () => false,
    fetcher: async (input, init) => {
      const url = String(input);
      if (url.includes("/model")) {
        selections.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      if (url.includes("/wait")) return new Response(null, { status: 204 });
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/api/session?")) {
        return new Response(JSON.stringify({ data: { id: "session-1" } }));
      }

      if (method === "POST" && url.includes("/api/session/session-1/prompt")) {
        promptBodies.push(JSON.parse(String(init?.body)));
        return acceptedPrompt();
      }

      throw new Error(`Unexpected: ${method} ${url}`);
    },
  });

  const result = await service.startSession({
    prompt: "hello",
    cwd: "/repo",
    model: "anthropic/claude-opus-4-6",
    params: { variant: "max" },
  });
  await result.messageComplete;

  expect(selections).toEqual([{ model: { providerID: "anthropic", id: "claude-opus-4-6", variant: "max" } }]);
  expect(promptBodies).toEqual([
    {
      text: "hello",
    },
  ]);
});

test("abortSession posts to the opencode abort endpoint", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const service = createOpencodeService({
    startServer: async () => ({ running: true, url: "http://127.0.0.1:4900", dispose: async () => {} }),
    serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
    isPortOpen: async () => false,
    pingServer: async () => false,
    fetcher: async (input, init) => {
      requests.push({ url: String(input), method: init?.method ?? "GET" });
      return new Response("true");
    },
  });

  await service.abortSession("session-1", "/repo");

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe("POST");

  const url = new URL(requests[0]!.url);
  expect(url.pathname).toBe("/api/session/session-1/interrupt");
  expect(url.searchParams.get("location[directory]")).toBe("/repo");
});
