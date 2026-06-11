import { describe, expect, mock, test } from "bun:test";
import type { HarnessExit } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { spawnAgentSession } from "./spawn-agent";

const CLAUDE_CODE_ID = testHarnessId("claude-code");

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

describe("spawnAgentSession lifecycle", () => {
  test("keeps the follow-up store entry created during terminal drain", async () => {
    const exit = Promise.withResolvers<HarnessExit>();
    const start = mock((_ctx: unknown, _input: unknown) => ({
      agentSessionId: "agent_session_1",
      done: exit.promise,
      stop: () => {},
    }));

    const registry = createTestHarnessRegistry([createTestHarnessRecord("claude-code", { provider: { start } })]);

    const storeEntries = new Map<string, ReturnType<typeof createStoreEntry>>();
    const remove = mock((id: string) => {
      storeEntries.delete(id);
    });
    const transitionStatus = mock(async () => {
      storeEntries.set("session_1", createStoreEntry());
      return { id: "session_1", project_id: "project_1", status: "completed" };
    });

    await spawnAgentSession({ sessionId: "session_1", agentId: CLAUDE_CODE_ID, prompt: "hello", cwd: "/repo" }, {
      harnessRegistry: registry,
      eventBus: { emit: () => {} },
      fileService: {
        get: async () => null,
        upload: async () => ({ id: "file_1" }),
        update: async () => null,
      },
      sessionService: {
        get: mock(async () => ({ id: "session_1", project_id: "project_1", status: "in_progress" })),
        update: async () => null,
        transitionStatus,
        store: {
          create: mock((id: string) => {
            const entry = createStoreEntry();
            storeEntries.set(id, entry);
            return entry;
          }),
          get: mock((id: string) => storeEntries.get(id) ?? null),
          setSession: mock(() => {}),
          remove,
        },
      },
    } as unknown as Parameters<typeof spawnAgentSession>[1]);

    exit.resolve({ status: "completed" });

    for (let index = 0; index < 20; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(remove).toHaveBeenCalledWith("session_1");
    expect(transitionStatus).toHaveBeenCalledWith("session_1", "completed");
    expect(storeEntries.has("session_1")).toBe(true);
  });
});
