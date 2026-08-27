import { describe, expect, test } from "bun:test";
import type { HarnessContext, SessionMessage } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { recordingSink } from "./opencode-session-poller.test-helpers";

// --- Helpers ---

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-open-code",
  name: "harness-open-code",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

const harness = (opts: { available?: boolean; modelsOutput?: string } = {}) =>
  createOpencodeHarness(
    {
      detect: async () => ({ available: opts.available ?? true }),
      getModelsOutput: async () => opts.modelsOutput ?? "",
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

const harnessDefaults = () => ({
  detect: async () => ({ available: true }),
  getModelsOutput: async () => "",
});

// --- Factory ---

describe("createOpencodeHarness", () => {
  test("returns a harness with id and label", () => {
    const h = harness();

    expect(h.id).toBe("opencode");
    expect(h.label).toEqual({ $l10n: "harness.opencode", default: "OpenCode" });
  });

  test("declares model thinking variants", () => {
    const h = harness();

    expect(h.params).toMatchObject({
      variant: {
        type: "select",
        label: "Thinking",
        defaultValue: "medium",
        options: [
          { label: "None", value: "none", icon: "CircleSlash" },
          { label: "Minimal", value: "minimal", icon: "CircleDot" },
          { label: "Low", value: "low", icon: "Gauge" },
          { label: "Medium", value: "medium", icon: "Brain" },
          { label: "High", value: "high", icon: "Zap" },
          { label: "XHigh", value: "xhigh", icon: "Flame" },
          { label: "Max", value: "max", icon: "Sparkles" },
        ],
      },
    });
  });

  test("reports capabilities", () => {
    const h = harness();

    expect(h.capabilities(ctx)).toEqual(["SessionFork", "ContextUsage", "SessionReattach"]);
  });
});

// --- Detection ---

describe("detect", () => {
  test("reports available when the CLI is present", async () => {
    const h = harness({ available: true });

    expect(await h.detect!(ctx)).toEqual({ available: true });
  });

  test("reports unavailable when the CLI is missing", async () => {
    const h = harness({ available: false });

    expect(await h.detect!(ctx)).toEqual({ available: false });
  });

  test("default detection runs opencode --version and reports its output", async () => {
    const h = createOpencodeHarness({}, serviceOverrides());
    const versionCtx: HarnessContext = {
      ...ctx,
      process: {
        ...ctx.process,
        run: async ({ command }) =>
          command[1] === "--version"
            ? { exitCode: 0, stdout: "0.6.0\n", stderr: "" }
            : { exitCode: 1, stdout: "", stderr: "" },
      },
    };

    expect(await h.detect!(versionCtx)).toEqual({ available: true, version: "0.6.0" });
  });

  test("default detection reports unavailable on non-zero exit", async () => {
    const h = createOpencodeHarness({}, serviceOverrides());
    const missingCtx: HarnessContext = {
      ...ctx,
      process: { ...ctx.process, run: async () => ({ exitCode: 1, stdout: "", stderr: "" }) },
    };

    expect(await h.detect!(missingCtx)).toEqual({ available: false });
  });
});

// --- Model listing ---

describe("listModels", () => {
  test("returns empty when not available", async () => {
    const h = harness({ available: false, modelsOutput: "openai/gpt-4" });

    expect(await h.listModels!(ctx)).toEqual([]);
  });

  test("returns empty for empty output", async () => {
    const h = harness({ modelsOutput: "" });

    expect(await h.listModels!(ctx)).toEqual([]);
  });

  test("parses JSON array of strings", async () => {
    const h = harness({ modelsOutput: JSON.stringify(["openai/gpt-4", "anthropic/claude-3"]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("parses JSON array of objects with id", async () => {
    const h = harness({ modelsOutput: JSON.stringify([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("parses JSON array of objects with model field", async () => {
    const h = harness({ modelsOutput: JSON.stringify([{ model: "openai/gpt-4" }]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("parses JSON array of objects with name field", async () => {
    const h = harness({ modelsOutput: JSON.stringify([{ name: "openai/gpt-4" }]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("parses JSON object with models array", async () => {
    const h = harness({ modelsOutput: JSON.stringify({ models: ["openai/gpt-4"] }) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("filters entries without slash", async () => {
    const h = harness({ modelsOutput: JSON.stringify(["gpt-4", "openai/gpt-4"]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("deduplicates model ids", async () => {
    const h = harness({ modelsOutput: JSON.stringify(["openai/gpt-4", "openai/gpt-4"]) });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("falls back to line-based parsing for non-JSON", async () => {
    const h = harness({ modelsOutput: "openai/gpt-4\nanthropic/claude-3\n" });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("extracts first token from lines with spaces", async () => {
    const h = harness({ modelsOutput: "openai/gpt-4  (default)\nanthropic/claude-3  (fast)\n" });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("skips lines without slash in line-based parsing", async () => {
    const h = harness({ modelsOutput: "Models:\nopenai/gpt-4\n---\nanthropic/claude-3\n" });

    expect(await h.listModels!(ctx)).toEqual([{ id: "openai/gpt-4" }, { id: "anthropic/claude-3" }]);
  });

  test("reads model output through ctx.process.run by default", async () => {
    const h = createOpencodeHarness({}, serviceOverrides());
    const modelsCtx: HarnessContext = {
      ...ctx,
      process: {
        ...ctx.process,
        run: async ({ command }) => ({
          exitCode: 0,
          stdout: command[1] === "models" ? "openai/gpt-4\n" : "0.6.0",
          stderr: "",
        }),
      },
    };

    expect(await h.listModels!(modelsCtx)).toEqual([{ id: "openai/gpt-4" }]);
  });

  test("caches discovered models", async () => {
    let discoveries = 0;
    const h = createOpencodeHarness(
      {
        detect: async () => ({ available: true }),
        getModelsOutput: async () => {
          discoveries += 1;
          return "openai/gpt-4";
        },
      },
      serviceOverrides(),
    );

    await h.listModels!(ctx);
    await h.listModels!(ctx);

    expect(discoveries).toBe(1);
  });
});

// --- getMessages ---

describe("getMessages", () => {
  test("normalizes messages from service", async () => {
    const mockMessages = [
      { role: "user", content: [{ type: "text", text: "hello" }] },
      { role: "assistant", content: [{ type: "text", text: "hi there" }] },
    ];

    const h = createOpencodeHarness(harnessDefaults(), {
      ...serviceOverrides(),
      fetcher: async () => new Response(JSON.stringify(mockMessages)),
    });

    const messages = await h.getMessages!(ctx, { agentSessionId: "session-1" });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].parts[0]).toMatchObject({ type: "text", text: "hello" });
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].parts[0]).toMatchObject({ type: "text", text: "hi there" });
  });
});

// --- timeoutStrategy ---

describe("timeoutStrategy", () => {
  test("start returns a session with provider timeout strategy", async () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

    const session = await h.start(ctx, {
      prompt: "hello",
      sessionId: "host-1",
      cwd: "/test",
      events: recordingSink().sink,
    });

    expect(session.agentSessionId).toStartWith("oc-");
    expect(session.timeoutStrategy).toBe("provider");

    await session.done;
  });

  test("resume returns a session with provider timeout strategy", async () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "follow-up",
      sessionId: "host-1",
      cwd: "/test",
      events: recordingSink().sink,
    });

    expect(session.agentSessionId).toBe("oc-1");
    expect(session.timeoutStrategy).toBe("provider");

    await session.done;
  });
});

// --- cancellation ---

describe("cancellation", () => {
  test("stop aborts the running opencode session", async () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

    const session = await h.start(ctx, {
      prompt: "hello",
      sessionId: "host-1",
      cwd: "/test",
      events: recordingSink().sink,
    });
    session.stop();

    const exit = await Promise.race([session.done, Bun.sleep(100).then(() => "timeout" as const)]);

    expect(exit).toEqual({ status: "cancelled" });
    expect(abortCalls).toBe(1);
  });

  test("stop logs opencode abort failures", async () => {
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

      const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });

      const session = await h.start(ctx, {
        prompt: "hello",
        sessionId: "host-1",
        cwd: "/test",
        events: recordingSink().sink,
      });
      session.stop();
      await session.done;
      await Bun.sleep(0);

      expect(errors).toEqual([["[opencode] failed to abort session oc-1", abortError]]);
    } finally {
      console.error = originalConsoleError;
    }
  });
});

// --- resume ---

describe("resume", () => {
  test("pushes follow-up messages to the event sink", async () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "follow-up",
      sessionId: "host-1",
      cwd: "/test",
      events: sink,
    });

    await session.done;

    const messagePatches = patches.filter((p) => p.path === "/messages");
    expect(messagePatches.length).toBeGreaterThan(0);

    const lastMessages = messagePatches[messagePatches.length - 1].value as SessionMessage[];
    expect(lastMessages).toHaveLength(4);
    expect(lastMessages[2].parts[0]).toMatchObject({ type: "text", text: "follow-up" });
    expect(lastMessages[3].parts[0]).toMatchObject({ type: "text", text: "Reply: follow-up" });
  });

  test("settles as failed when message POST fails", async () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "will fail",
      sessionId: "host-1",
      cwd: "/test",
      events: sink,
    });

    const exit = await session.done;
    expect(exit).toEqual({ status: "failed" });

    const messagePatches = patches.filter((patch) => patch.path === "/messages");
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "will timeout",
      sessionId: "host-1",
      cwd: "/test",
      events: sink,
    });

    const exit = await session.done;
    expect(exit).toEqual({ status: "completed" });

    const statusPatches = patches.filter((p) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("completed");

    const messagePatches = patches.filter((p) => p.path === "/messages");
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "run validate",
      sessionId: "host-1",
      cwd: "/test",
      events: sink,
    });

    const exit = await session.done;
    expect(exit).toEqual({ status: "disconnected" });

    const statusPatches = patches.filter((p) => p.path === "/status");
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "will fail",
      sessionId: "host-1",
      cwd: "/test",
      events: sink,
    });

    await session.done;

    const messagePatches = patches.filter((p) => p.path === "/messages");
    const finalMessages = messagePatches[messagePatches.length - 1]?.value as SessionMessage[];

    expect(finalMessages.at(-1)?.parts).toContainEqual({
      type: "error",
      errorType: "permission",
      message: "OpenCode session.prompt failed: HTTP 403 permission denied",
    });
  });
});

// --- reattach ---

describe("reattach", () => {
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.reattach!(ctx, {
      sessionId: "host-1",
      agentSessionId: "oc-1",
      cwd: "/test",
      events: sink,
    });
    expect(session.timeoutStrategy).toBe("provider");

    const exit = await session.done;
    expect(exit).toEqual({ status: "completed" });

    const statusPatches = patches.filter((p) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("completed");

    const messagePatches = patches.filter((p) => p.path === "/messages");
    const last = messagePatches.at(-1)?.value as SessionMessage[];
    expect(last.at(-1)?.parts[0]).toMatchObject({ type: "text", text: "done" });
  });

  test("exits immediately when no trailing assistant message", async () => {
    const fetcher = async () => new Response(JSON.stringify([]));
    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.reattach!(ctx, {
      sessionId: "host-1",
      agentSessionId: "oc-1",
      cwd: "/test",
      events: sink,
    });
    const exit = await session.done;
    expect(exit).toEqual({ status: "completed" });

    const statusPatches = patches.filter((p) => p.path === "/status");
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

    const h = createOpencodeHarness(harnessDefaults(), { ...serviceOverrides(), fetcher });
    const { patches, sink } = recordingSink();

    const session = await h.reattach!(ctx, {
      sessionId: "host-1",
      agentSessionId: "oc-1",
      cwd: "/test",
      events: sink,
    });
    const exit = await session.done;

    expect(exit).toEqual({ status: "disconnected" });

    const statusPatches = patches.filter((p) => p.path === "/status");
    expect(statusPatches.at(-1)?.value).toBe("disconnected");
  });

  test("advertises SessionReattach capability", () => {
    const h = harness();
    expect(h.capabilities(ctx)).toContain("SessionReattach");
  });
});
