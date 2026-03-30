import { describe, expect, mock, test } from "bun:test";
import { createSessionHandler } from "./create-session";

const createContext = (body: {
  project_id: string;
  title: string;
  prompt: string;
  agent: string;
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

describe("createSessionHandler hooks", () => {
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
      },
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => null,
        link: async () => ({}),
      },
      sessionService: {
        create: sessionCreate,
        transitionStatus,
        store: {
          create: mock(() => ({
            eventStore: { push: () => {}, getHistory: () => [] },
            approvalService: { handleResponse: () => {} },
          })),
          get: mock(() => null),
          setProcess: mock(() => {}),
          remove: mock(() => {}),
        },
      },
      eventBus: {
        emit: () => {},
      },
      agentRegistry: {
        get: () => null,
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
