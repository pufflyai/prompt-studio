import { describe, expect, test } from "bun:test";
import { createEventStore } from "../../services/event-store";
import type { JsonPatch, SessionMessage } from "../../types";
import { createOpencodeAgent } from "./opencode-agent";

// --- Helper ---

const agent = (opts: { available?: boolean; modelsOutput?: string } = {}) =>
  createOpencodeAgent(
    {
      isCommandAvailable: () => opts.available ?? true,
      getModelsOutput: () => opts.modelsOutput ?? "",
    },
    {
      startServer: async () => "http://localhost:4096",
      serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
      pingServer: async () => false,
      isPortOpen: async () => false,
      fetcher: async () => new Response("{}"),
    },
  );

type MockMessage = { role: string; content: { type: string; text: string }[] };

const serviceOverrides = () => ({
  startServer: async () => "http://localhost:4096",
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
});

const agentDefaults = () => ({
  isCommandAvailable: () => true,
  getModelsOutput: () => "",
});

// --- Factory ---

describe("createOpencodeAgent", () => {
  test("returns an agent with id and name", () => {
    const a = agent();

    expect(a.id).toBe("opencode");
    expect(a.name).toBe("OpenCode");
  });

  test("reports capabilities", () => {
    const a = agent();

    expect(a.capabilities()).toEqual(["SessionFork", "ContextUsage", "SessionReattach"]);
  });
});

// --- Availability ---

describe("checkAvailability", () => {
  test("returns INSTALLED when command is available", () => {
    const a = agent({ available: true });

    expect(a.checkAvailability()).toEqual({ type: "INSTALLED" });
  });

  test("returns NOT_FOUND when command is unavailable", () => {
    const a = agent({ available: false });

    expect(a.checkAvailability()).toEqual({ type: "NOT_FOUND" });
  });
});

// --- Model listing ---

describe("listModels", () => {
  test("returns empty when not available", () => {
    const a = agent({ available: false, modelsOutput: "openai/gpt-4" });

    expect(a.listModels()).toEqual([]);
  });

  test("returns empty for empty output", () => {
    const a = agent({ modelsOutput: "" });

    expect(a.listModels()).toEqual([]);
  });

  test("parses JSON array of strings", () => {
    const a = agent({ modelsOutput: JSON.stringify(["openai/gpt-4", "anthropic/claude-3"]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("parses JSON array of objects with id", () => {
    const a = agent({ modelsOutput: JSON.stringify([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("parses JSON array of objects with model field", () => {
    const a = agent({ modelsOutput: JSON.stringify([{ model: "openai/gpt-4" }]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("parses JSON array of objects with name field", () => {
    const a = agent({ modelsOutput: JSON.stringify([{ name: "openai/gpt-4" }]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("parses JSON object with models array", () => {
    const a = agent({ modelsOutput: JSON.stringify({ models: ["openai/gpt-4"] }) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("filters entries without slash", () => {
    const a = agent({ modelsOutput: JSON.stringify(["gpt-4", "openai/gpt-4"]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("deduplicates model ids", () => {
    const a = agent({ modelsOutput: JSON.stringify(["openai/gpt-4", "openai/gpt-4"]) });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("falls back to line-based parsing for non-JSON", () => {
    const a = agent({ modelsOutput: "openai/gpt-4\nanthropic/claude-3\n" });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("extracts first token from lines with spaces", () => {
    const a = agent({ modelsOutput: "openai/gpt-4  (default)\nanthropic/claude-3  (fast)\n" });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("skips lines without slash in line-based parsing", () => {
    const a = agent({ modelsOutput: "Models:\nopenai/gpt-4\n---\nanthropic/claude-3\n" });

    expect(a.listModels()).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });
});

// --- getMessages ---

describe("getMessages", () => {
  test("normalizes messages from service", async () => {
    const mockMessages = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi there" }] },
    ];

    const a = createOpencodeAgent(
      { isCommandAvailable: () => true, getModelsOutput: () => "" },
      {
        startServer: async () => "http://localhost:4096",
        serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
        pingServer: async () => true,
        isPortOpen: async () => true,
        fetcher: async () => new Response(JSON.stringify(mockMessages)),
      },
    );

    const messages = await a.getMessages("session-1");

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].parts[0]).toMatchObject({ type: "text", text: "hello" });
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].parts[0]).toMatchObject({ type: "text", text: "hi there" });
  });
});

// --- timeoutStrategy ---

describe("timeoutStrategy", () => {
  test("startSession returns process with provider timeout strategy", async () => {
    const sessionMessages: Record<string, MockMessage[]> = {};
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/session?")) {
        const id = `oc-${crypto.randomUUID().slice(0, 8)}`;
        sessionMessages[id] = [];
        return new Response(JSON.stringify({ id }));
      }

      if (method === "POST" && url.match(/\/session\/[^/]+\/message/)) {
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      if (method === "GET" && url.match(/\/session\/[^/]+\/message/)) {
        return new Response(JSON.stringify([]));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.startSession({ prompt: "hello", cwd: "/test", eventStore });

    expect(result.process).toBeDefined();
    expect(result.process!.timeoutStrategy).toBe("provider");
  });

  test("resumeSession returns process with provider timeout strategy", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/message")) {
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      if (method === "GET" && url.includes("/message")) {
        return new Response(JSON.stringify([]));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "follow-up", cwd: "/test" }, eventStore);

    expect(result.process).toBeDefined();
    expect(result.process!.timeoutStrategy).toBe("provider");
  });
});

// --- cancellation ---

describe("cancellation", () => {
  test("process kill aborts the running opencode session", async () => {
    let abortCalls = 0;
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/session?")) {
        return new Response(JSON.stringify({ id: "oc-1" }));
      }

      if (method === "POST" && url.includes("/session/oc-1/message")) {
        return new Promise<Response>(() => {});
      }

      if (method === "POST" && url.includes("/session/oc-1/abort")) {
        abortCalls += 1;
        return new Response("true");
      }

      if (method === "GET" && url.includes("/session/oc-1/message")) {
        return new Response(JSON.stringify([]));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.startSession({ prompt: "hello", cwd: "/test", eventStore });
    result.process!.kill();

    const exit = await Promise.race([result.process!.onExit, Bun.sleep(100).then(() => "timeout" as const)]);

    expect(exit).toEqual({ code: null, signal: "SIGTERM" });
    expect(abortCalls).toBe(1);
  });

  test("process kill logs opencode abort failures", async () => {
    const originalConsoleError = console.error;
    const errors: unknown[][] = [];
    const abortError = new Error("server down");

    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    try {
      const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (method === "POST" && url.includes("/session?")) {
          return new Response(JSON.stringify({ id: "oc-1" }));
        }

        if (method === "POST" && url.includes("/session/oc-1/message")) {
          return new Promise<Response>(() => {});
        }

        if (method === "POST" && url.includes("/session/oc-1/abort")) {
          throw abortError;
        }

        if (method === "GET" && url.includes("/session/oc-1/message")) {
          return new Response(JSON.stringify([]));
        }

        return new Response("{}", { status: 404 });
      };

      const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
      const eventStore = createEventStore();

      const result = await a.startSession({ prompt: "hello", cwd: "/test", eventStore });
      result.process!.kill();
      await result.process!.onExit;
      await Bun.sleep(0);

      expect(errors).toEqual([["[opencode] failed to abort session oc-1", abortError]]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

// --- resumeSession ---

describe("resumeSession", () => {
  test("pushes follow-up messages to event store", async () => {
    const sessionMessages: Record<string, MockMessage[]> = {
      "oc-1": [
        { role: "user", content: [{ type: "text", text: "initial" }] },
        { role: "assistant", content: [{ type: "text", text: "response" }] },
      ],
    };

    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      const postMatch = method === "POST" && url.match(/\/session\/([^/]+)\/message/);
      if (postMatch) {
        const id = postMatch[1];
        const body = JSON.parse(init?.body as string);
        sessionMessages[id] = sessionMessages[id] ?? [];
        sessionMessages[id].push(
          { role: "user", content: [{ type: "text", text: body.parts[0].text }] },
          { role: "assistant", content: [{ type: "text", text: `Reply: ${body.parts[0].text}` }] },
        );
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      const getMatch = method === "GET" && url.match(/\/session\/([^/]+)\/message/);
      if (getMatch) {
        return new Response(JSON.stringify(sessionMessages[getMatch[1]] ?? []));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "follow-up", cwd: "/test" }, eventStore);

    await result.process!.onExit;

    const history = eventStore.getHistory();
    const messagePatches = history.filter((p: JsonPatch) => p.path === "/messages");
    expect(messagePatches.length).toBeGreaterThan(0);

    const lastMessages = messagePatches[messagePatches.length - 1].value as SessionMessage[];
    expect(lastMessages).toHaveLength(4);
    expect(lastMessages[2].parts[0]).toMatchObject({ type: "text", text: "follow-up" });
    expect(lastMessages[3].parts[0]).toMatchObject({ type: "text", text: "Reply: follow-up" });
  });

  test("returns non-zero exit code when message POST fails", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/message")) {
        return new Response("Internal Server Error", { status: 500 });
      }

      if (method === "GET" && url.includes("/message")) {
        return new Response(JSON.stringify([]));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "will fail", cwd: "/test" }, eventStore);

    const exit = await result.process!.onExit;
    expect(exit.code).not.toBe(0);

    const history = eventStore.getHistory();
    const messagePatches = history.filter((patch: JsonPatch) => patch.path === "/messages");
    const hasConversationError = messagePatches.some((patch) => {
      if (!Array.isArray(patch.value)) return false;

      return patch.value.some((message) => {
        const parts = (message as SessionMessage).parts ?? [];
        return parts.some((part) => part.type === "error");
      });
    });

    expect(hasConversationError).toBe(true);
  });

  test("POST timeout still completes when polling observes turn finished on server", async () => {
    // Regression for the bug where treating the POST /message HTTP lifetime as
    // the source of turn liveness caused long-running turns to be marked as
    // disconnected. POST is only an enqueue step; turn completion must come
    // from polling the server's session state.
    let getCalls = 0;
    const buildSessionMessagesResponse = () => {
      getCalls += 1;
      // Call 1 = baseline fetch (1 prior user message).
      // Calls 2+ = after POST timed out, the server still accepted the turn
      // and eventually marks the assistant message complete.
      if (getCalls === 1) {
        return new Response(
          JSON.stringify([
            {
              info: { id: "u0", role: "user", time: { created: 1, completed: 2 } },
              parts: [{ type: "text", text: "prior" }],
            },
          ]),
        );
      }

      const completed = getCalls >= 3;
      return new Response(
        JSON.stringify([
          {
            info: { id: "u0", role: "user", time: { created: 1, completed: 2 } },
            parts: [{ type: "text", text: "prior" }],
          },
          {
            info: { id: "u1", role: "user", time: { created: 3, completed: 4 } },
            parts: [{ type: "text", text: "will timeout" }],
          },
          {
            info: {
              id: "a1",
              role: "assistant",
              time: completed ? { created: 5, completed: 6 } : { created: 5 },
            },
            parts: [{ type: "text", text: completed ? "done" : "working..." }],
          },
        ]),
      );
    };

    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/message")) {
        throw new DOMException("The operation was aborted", "AbortError");
      }

      if (method === "GET" && url.match(/\/session\/[^/]+\/message/)) {
        return buildSessionMessagesResponse();
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "will timeout", cwd: "/test" }, eventStore);

    const exit = await result.process!.onExit;
    expect(exit.code).toBe(0);

    const history = eventStore.getHistory();
    const statusPatches = history.filter((p: JsonPatch) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("completed");

    const messagePatches = history.filter((p: JsonPatch) => p.path === "/messages");
    const last = messagePatches.at(-1)?.value as SessionMessage[];
    expect(last.at(-1)?.parts[0]).toMatchObject({ type: "text", text: "done" });
  });

  test("disconnects when the trailing assistant turn stays stale", async () => {
    const staleCreatedAt = Date.now() - 31 * 60 * 1000;
    let getCalls = 0;
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/message")) {
        return new Response(JSON.stringify({ info: {}, parts: [] }));
      }

      if (method === "GET" && url.match(/\/session\/[^/]+\/message/)) {
        getCalls += 1;

        if (getCalls === 1) {
          return new Response(
            JSON.stringify([
              {
                info: { id: "u0", role: "user", time: { created: 1, completed: 2 } },
                parts: [{ type: "text", text: "prior" }],
              },
            ]),
          );
        }

        return new Response(
          JSON.stringify([
            {
              info: { id: "u0", role: "user", time: { created: 1, completed: 2 } },
              parts: [{ type: "text", text: "prior" }],
            },
            {
              info: { id: "u1", role: "user", time: { created: 3, completed: 4 } },
              parts: [{ type: "text", text: "run validate" }],
            },
            {
              info: {
                id: "a1",
                role: "assistant",
                time: { created: staleCreatedAt },
              },
              parts: [{ type: "step-start", snapshot: "Running validate" }],
            },
          ]),
        );
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "run validate", cwd: "/test" }, eventStore);

    const exit = await result.process!.onExit;
    expect(exit).toEqual({ code: null, signal: "TIMEOUT" });

    const history = eventStore.getHistory();
    const statusPatches = history.filter((p: JsonPatch) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("disconnected");
  });

  test("appends normalized error message when message POST fails", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && url.includes("/message")) {
        return new Response("permission denied", { status: 403 });
      }

      if (method === "GET" && url.includes("/message")) {
        return new Response(JSON.stringify([]));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.resumeSession({ sessionId: "oc-1", prompt: "will fail", cwd: "/test" }, eventStore);

    await result.process!.onExit;

    const history = eventStore.getHistory();
    const messagePatches = history.filter((p: JsonPatch) => p.path === "/messages");
    const finalMessages = messagePatches[messagePatches.length - 1]?.value as SessionMessage[];

    expect(finalMessages.at(-1)?.parts).toContainEqual({
      type: "error",
      errorType: "permission",
      message: "OpenCode session.prompt failed: HTTP 403 permission denied",
    });
  });
});

// --- reattachSession ---

describe("reattachSession", () => {
  test("polls until trailing assistant message has time.completed", async () => {
    let getCalls = 0;
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && url.match(/\/session\/[^/]+\/message/)) {
        getCalls += 1;
        // First two responses: turn in flight (no time.completed on tail)
        // Third response: completed
        const completed = getCalls >= 3;
        const messages = [
          {
            info: { id: "m-user", role: "user", time: { created: 1, completed: 2 } },
            parts: [{ type: "text", text: "hi" }],
          },
          {
            info: {
              id: "m-asst",
              role: "assistant",
              time: completed ? { created: 3, completed: 4 } : { created: 3 },
            },
            parts: [{ type: "text", text: completed ? "done" : "working..." }],
          },
        ];
        return new Response(JSON.stringify(messages));
      }

      return new Response("{}", { status: 404 });
    };

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.reattachSession!({ sessionId: "oc-1", cwd: "/test" }, eventStore);
    expect(result.process).toBeDefined();
    expect(result.process!.timeoutStrategy).toBe("provider");

    const exit = await result.process!.onExit;
    expect(exit.code).toBe(0);

    const history = eventStore.getHistory();
    const statusPatches = history.filter((p: JsonPatch) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("completed");

    const messagePatches = history.filter((p: JsonPatch) => p.path === "/messages");
    const last = messagePatches.at(-1)?.value as SessionMessage[];
    expect(last.at(-1)?.parts[0]).toMatchObject({ type: "text", text: "done" });
  });

  test("exits immediately when no trailing assistant message", async () => {
    const fetcher = async () => new Response(JSON.stringify([]));
    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.reattachSession!({ sessionId: "oc-1", cwd: "/test" }, eventStore);
    const exit = await result.process!.onExit;
    expect(exit.code).toBe(0);

    const history = eventStore.getHistory();
    const statusPatches = history.filter((p: JsonPatch) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("completed");
  });

  test("disconnects stale in-flight sessions during reattach", async () => {
    const staleCreatedAt = Date.now() - 31 * 60 * 1000;
    const fetcher = async () =>
      new Response(
        JSON.stringify([
          {
            info: { id: "m-user", role: "user", time: { created: 1, completed: 2 } },
            parts: [{ type: "text", text: "hi" }],
          },
          {
            info: {
              id: "m-asst",
              role: "assistant",
              time: { created: staleCreatedAt },
            },
            parts: [{ type: "step-start", snapshot: "Still running" }],
          },
        ]),
      );

    const a = createOpencodeAgent(agentDefaults(), { ...serviceOverrides(), fetcher });
    const eventStore = createEventStore();

    const result = await a.reattachSession!({ sessionId: "oc-1", cwd: "/test" }, eventStore);
    const exit = await result.process!.onExit;

    expect(exit).toEqual({ code: null, signal: "TIMEOUT" });

    const history = eventStore.getHistory();
    const statusPatches = history.filter((p: JsonPatch) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("disconnected");
  });

  test("advertises SessionReattach capability", () => {
    const a = agent();
    expect(a.capabilities()).toContain("SessionReattach");
  });
});
