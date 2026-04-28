import { describe, expect, mock, test } from "bun:test";
import { Writable } from "node:stream";
import type { RuntimeHarnessProvider } from "@pstdio/sdk/extensions";
import { createEventStore, type EventStore } from "pstdio-agents";
import { spawnAgentSession } from "./spawn-agent";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createWritable = () =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

const createOpencodeProvider = (onExit: Promise<{ code: number | null; signal: string | null }>) =>
  ({
    id: "pstdio.harness.opencode",
    key: "opencode",
    extensionId: "pstdio.harness.opencode",
    label: "OpenCode",
    start: async () => ({ runId: "run" }),
    startSession: async () => ({
      sessionId: "oc_session_1",
      process: {
        sessionId: "oc_session_1",
        stdin: createWritable(),
        kill: () => {},
        onExit,
        timeoutStrategy: "provider" as const,
      },
    }),
    resumeSession: async () => ({}),
    getMessages: async () => [],
  }) satisfies RuntimeHarnessProvider;

const createDeps = (
  eventStore: EventStore & { close(): void },
  transitionStatus: ReturnType<typeof mock>,
  remove: ReturnType<typeof mock>,
  provider: RuntimeHarnessProvider,
  options?: { processExitTimeoutMs?: number },
) =>
  ({
    harnessProviderService: {
      resolve: async () => ({ provider, context: {} }),
    },
    eventBus: { emit: () => {} },
    fileService: {
      get: async () => null,
      upload: async () => ({ id: "file_1" }),
      update: async () => null,
    },
    sessionService: {
      get: async () => null,
      update: async () => null,
      transitionStatus,
      store: {
        create: mock(() => ({
          eventStore,
          approvalService: { handleResponse: () => {}, dispose: () => {} },
        })),
        get: mock(() => ({
          eventStore,
          approvalService: { handleResponse: () => {}, dispose: () => {} },
        })),
        setProcess: mock(() => {}),
        remove,
      },
    },
    processExitTimeoutMs: options?.processExitTimeoutMs,
  }) as unknown as Parameters<typeof spawnAgentSession>[1];

const waitForTransition = async (transitionStatus: ReturnType<typeof mock>) => {
  for (let index = 0; index < 40; index += 1) {
    if (transitionStatus.mock.calls.length > 0) return;
    await wait(10);
  }
};

describe("OpenCode session timeout repro", () => {
  test("quiet OpenCode session does not fail while daemon is still processing", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});

    await spawnAgentSession(
      { sessionId: "session_1", agentId: "opencode", prompt: "hello", cwd: "/repo" },
      createDeps(createEventStore(), transitionStatus, remove, createOpencodeProvider(onExit), {
        processExitTimeoutMs: 20,
      }),
    );

    await wait(60);
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    resolveExit({ code: 0, signal: null });
    await waitForTransition(transitionStatus);

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(remove).toHaveBeenCalledWith("session_1");
  });

  test("resumed OpenCode session does not re-fail under quiet condition", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const transitionStatus = mock(async () => ({ id: "session_1", project_id: "project_1", status: "completed" }));
    const remove = mock(() => {});

    await spawnAgentSession(
      { sessionId: "session_1", agentId: "opencode", prompt: "resumed follow-up", cwd: "/repo" },
      createDeps(createEventStore(), transitionStatus, remove, createOpencodeProvider(onExit), {
        processExitTimeoutMs: 20,
      }),
    );

    await wait(60);
    expect(transitionStatus).toHaveBeenCalledTimes(0);

    resolveExit({ code: 0, signal: null });
    await waitForTransition(transitionStatus);

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
  });

  test("POST timeout transitions API session to disconnected, not completed or failed", async () => {
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const transitionStatus = mock(async () => ({
      id: "session_1",
      project_id: "project_1",
      status: "disconnected",
    }));
    const remove = mock(() => {});

    await spawnAgentSession(
      { sessionId: "session_1", agentId: "opencode", prompt: "hello", cwd: "/repo" },
      createDeps(createEventStore(), transitionStatus, remove, createOpencodeProvider(onExit), {
        processExitTimeoutMs: 20,
      }),
    );

    resolveExit({ code: null, signal: "TIMEOUT" });
    await waitForTransition(transitionStatus);

    expect(transitionStatus).toHaveBeenCalledWith("session_1", "disconnected");
    expect(remove).toHaveBeenCalledWith("session_1");
  });
});
