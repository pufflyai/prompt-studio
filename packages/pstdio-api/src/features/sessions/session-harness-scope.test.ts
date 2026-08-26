import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { getSessionMessages } from "./get-session-messages";
import { createSessionScheduler } from "./session-scheduler";
import { resolveOrphanedSessions } from "./startup";

const PROJECT_ID = "project-1";
const AGENT_ID = testHarnessId("opencode");
const tempRoots: string[] = [];

const createDisabledProjectRegistry = (record = createTestHarnessRecord("opencode")) => {
  const base = createTestHarnessRegistry([record], {
    disabledByProject: { [PROJECT_ID]: [AGENT_ID] },
  });
  const get = mock(base.get);

  return { get, registry: { ...base, get } };
};

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("project-scoped session harness reads", () => {
  test("orphan recovery does not inspect a host-wide harness disabled for the project", async () => {
    const reattach = mock(() => ({ done: Promise.resolve({ status: "completed" as const }), stop: () => {} }));
    const { get, registry } = createDisabledProjectRegistry(
      createTestHarnessRecord("opencode", {
        provider: {
          capabilities: () => ["SessionReattach"],
          reattach,
        },
      }),
    );
    const transitionStatus = mock(async () => null);
    const staleSession = {
      id: "session-1",
      agent: AGENT_ID,
      agent_session_id: "agent-session-1",
      cwd: "/work",
      project_id: PROJECT_ID,
    };
    const deps = {
      eventBus: { emit: () => {} },
      fileService: {},
      harnessRegistry: registry,
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [],
        remove: async () => {},
      },
      sessionService: {
        listByStatus: async () => [staleSession],
        store: { get: () => null, remove: () => {} },
        transitionStatus,
      },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AGENT_ID, { projectId: PROJECT_ID });
    expect(reattach).not.toHaveBeenCalled();
    expect(transitionStatus).toHaveBeenCalledWith(staleSession.id, "disconnected");
  });

  test("queue recovery treats a project-disabled reattach harness as unavailable", async () => {
    const { get, registry } = createDisabledProjectRegistry(
      createTestHarnessRecord("opencode", {
        provider: {
          capabilities: () => ["SessionReattach"],
          reattach: () => ({ done: new Promise(() => {}), stop: () => {} }),
        },
      }),
    );
    const recoverQueuedDispatchClaim = mock(async () => null);
    const session = {
      id: "session-2",
      agent: AGENT_ID,
      agent_session_id: "agent-session-2",
      project_id: PROJECT_ID,
      status: "in_progress",
    };
    const deps = {
      harnessRegistry: registry,
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [{ session_id: session.id, queue_position: 4 }],
        listPending: async () => [],
      },
      sessionService: {
        get: async () => session,
        recoverQueuedDispatchClaim,
        store: { get: () => null },
      },
    } as unknown as Parameters<typeof createSessionScheduler>[0];

    await createSessionScheduler(deps).recoverQueuedSessions();

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AGENT_ID, { projectId: PROJECT_ID });
    expect(recoverQueuedDispatchClaim).toHaveBeenCalledWith(session.id, 4);
  });

  test("message reads fall back to persisted messages when the project harness is disabled", async () => {
    const agentMessage: SessionMessage = {
      id: "agent-message",
      role: "assistant",
      parts: [{ type: "text", text: "host-wide message" }],
    };
    const persistedMessage: SessionMessage = {
      id: "persisted-message",
      role: "assistant",
      parts: [{ type: "text", text: "persisted message" }],
    };
    const getMessages = mock(() => [agentMessage]);
    const { get, registry } = createDisabledProjectRegistry(
      createTestHarnessRecord("opencode", { provider: { getMessages } }),
    );
    const root = mkdtempSync(join(tmpdir(), "pstdio-session-harness-scope-test-"));
    tempRoots.push(root);
    const storagePath = join(root, "messages.json");
    writeFileSync(storagePath, JSON.stringify([persistedMessage]));
    const session = {
      id: "session-3",
      agent: AGENT_ID,
      agent_session_id: "agent-session-3",
      cwd: "/work",
      project_id: PROJECT_ID,
      session_file_id: "file-1",
    };
    const deps = {
      fileService: { get: async () => ({ storage_path: storagePath }) },
      harnessRegistry: registry,
      sessionService: {
        get: async () => session,
        store: { get: () => null },
      },
    } as unknown as Parameters<typeof getSessionMessages>[1];

    const messages = await getSessionMessages(session.id, deps);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AGENT_ID, { projectId: PROJECT_ID });
    expect(getMessages).not.toHaveBeenCalled();
    expect(messages).toEqual([persistedMessage]);
  });
});
