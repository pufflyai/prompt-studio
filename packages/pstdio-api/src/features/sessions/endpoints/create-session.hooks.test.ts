import { describe, expect, mock, test } from "bun:test";
import { createEventStore } from "pstdio-api-runtime-host";
import { testHarnessId } from "../../harnesses/test-harness-registry";
import { createSessionHandler } from "./create-session";

const FAKE_ID = testHarnessId("fake");

const createContext = (body: {
  project_id: string;
  title: string;
  prompt: string;
  agent?: string;
  model?: string;
  workspace_id?: string;
}) => {
  const response: { status: number; body: unknown } = { status: 201, body: null };

  return {
    context: {
      req: {
        valid: () => body,
      },
      json: (jsonBody: unknown, status: number) => {
        response.status = status;
        response.body = jsonBody;
        return response;
      },
    },
    response,
  };
};

const createStoreEntry = () => ({
  eventStore: createEventStore(),
  approvalService: { handleResponse: () => {}, dispose: () => {} },
});

describe("createSessionHandler hooks", () => {
  test("uses configured default agent when request omits agent", async () => {
    const sessionCreate = mock(async (input: { agent: string }) => ({
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      title: "Session",
      agent: input.agent,
    }));
    const deps = {
      projectService: {
        get: async () => ({ id: "project-1" }),
      },
      repoService: {
        listByProject: async () => [],
      },
      workspaceService: {
        get: async () => null,
        getByShorthand: async () => null,
      },
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => null,
        link: async () => ({}),
      },
      sessionService: {
        create: sessionCreate,
        get: async () => null,
        countActive: mock(async () => 0),
        update: mock(async () => null),
        transitionStatus: mock(async () => null),
        store: {
          create: mock(() => createStoreEntry()),
          get: mock(() => null),
          setSession: mock(() => {}),
          remove: mock(() => {}),
        },
      },
      agentConfigService: {
        list: async () => [{ agent_id: FAKE_ID, is_default: true }],
      },
      settingsService: {
        get: async () => ({ max_concurrent_sessions: null }),
      },
      eventBus: {
        emit: () => {},
      },
      harnessRegistry: {
        get: async () => ({
          start: async () => ({
            agentSessionId: "agent-session-1",
            done: new Promise(() => {}),
            stop: () => {},
          }),
        }),
      },
      activityEventsService: {
        create: async () => ({}),
      },
    } as unknown as Parameters<typeof createSessionHandler>[0];

    const handler = createSessionHandler(deps);
    const { context, response } = createContext({
      project_id: "project-1",
      title: "Session",
      prompt: "Run task",
    });
    await handler(context as never, undefined as never);

    expect(response.status).toBe(201);
    expect(sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: FAKE_ID,
      }),
      { emitStartedHook: false },
    );
  });

  test("returns 400 when request omits agent and no default agent is configured", async () => {
    const sessionCreate = mock(async () => ({
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      title: "Session",
      agent: FAKE_ID,
    }));
    const deps = {
      projectService: {
        get: async () => ({ id: "project-1" }),
      },
      repoService: {
        listByProject: async () => [],
      },
      workspaceService: {
        get: async () => null,
        getByShorthand: async () => null,
      },
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => null,
        link: async () => ({}),
      },
      sessionService: {
        create: sessionCreate,
        countActive: mock(async () => 0),
        transitionStatus: mock(async () => null),
        store: {
          create: mock(() => createStoreEntry()),
          get: mock(() => null),
          setSession: mock(() => {}),
          remove: mock(() => {}),
        },
      },
      agentConfigService: {
        list: async () => [],
      },
      settingsService: {
        get: async () => ({ max_concurrent_sessions: null }),
      },
      eventBus: {
        emit: () => {},
      },
      harnessRegistry: {
        get: async () => null,
      },
      activityEventsService: {
        create: async () => ({}),
      },
    } as unknown as Parameters<typeof createSessionHandler>[0];

    const handler = createSessionHandler(deps);
    const { context, response } = createContext({
      project_id: "project-1",
      title: "Session",
      prompt: "Run task",
    });
    await handler(context as never, undefined as never);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "No agent configured. Set a default agent with 'pstdio agents setup' first.",
    });
    expect(sessionCreate).not.toHaveBeenCalled();
  });

  test("calls sessionService.transitionStatus to failed when agent startup fails", async () => {
    const transitionStatus = mock(async () => ({ id: "session-1", project_id: "project-1", status: "failed" }));
    const sessionCreate = mock(async () => ({
      id: "session-1",
      project_id: "project-1",
      status: "in_progress",
      title: "Session",
      agent: "missing-agent",
    }));
    const deps = {
      projectService: {
        get: async () => ({ id: "project-1" }),
      },
      repoService: {
        listByProject: async () => [],
      },
      workspaceService: {
        get: async () => null,
        getByShorthand: async () => null,
      },
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => null,
        link: async () => ({}),
      },
      sessionService: {
        create: sessionCreate,
        countActive: mock(async () => 0),
        transitionStatus,
        store: {
          create: mock(() => createStoreEntry()),
          get: mock(() => null),
          setSession: mock(() => {}),
          remove: mock(() => {}),
        },
      },
      agentConfigService: {
        list: async () => [],
      },
      settingsService: {
        get: async () => ({ max_concurrent_sessions: null }),
      },
      eventBus: {
        emit: () => {},
      },
      harnessRegistry: {
        get: async () => ({
          start: async () => {
            throw new Error("agent startup failed");
          },
        }),
      },
      activityEventsService: {
        create: async () => ({}),
      },
    } as unknown as Parameters<typeof createSessionHandler>[0];

    const handler = createSessionHandler(deps);
    const { context, response } = createContext({
      project_id: "project-1",
      title: "Session",
      prompt: "Run task",
      agent: "missing-agent",
    });
    await handler(context as never, undefined as never);

    expect(response.status).toBe(201);

    for (let index = 0; index < 30; index += 1) {
      if (transitionStatus.mock.calls.length > 0) break;
      await Bun.sleep(10);
    }

    expect(transitionStatus).toHaveBeenCalledWith("session-1", "failed");
  });
});
