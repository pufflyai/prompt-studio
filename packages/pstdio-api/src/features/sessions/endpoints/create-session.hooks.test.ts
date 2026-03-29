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
  test("fires post-session-fail when agent startup fails", async () => {
    const listByProject = mock(async () => []);
    const updateStatus = mock(async () => ({ id: "session-1", project_id: "project-1", status: "failed" }));
    const getWorkspaceBySessionId = mock(async () => null);
    const deps = {
      projectsService: {
        get: async () => ({ id: "project-1" }),
      },
      reposService: {
        listByProject,
      },
      sessionsService: {
        create: async () => ({
          id: "session-1",
          project_id: "project-1",
          status: "in_progress",
          title: "Session",
          agent: "missing-agent",
        }),
        updateStatus,
      },
      workspacesService: {
        get: async () => null,
      },
      workspaceSessionsService: {
        getWorkspaceBySessionId,
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
      if (getWorkspaceBySessionId.mock.calls.length >= 2) break;
      await Bun.sleep(10);
    }

    expect(updateStatus).toHaveBeenCalledWith("session-1", "failed");
    // post-session-start + post-session-fail
    expect(getWorkspaceBySessionId.mock.calls.length).toBeGreaterThanOrEqual(2);
    // post-session-start + post-session-fail
    expect(listByProject.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
