import { describe, expect, mock, test } from "bun:test";
import { approveSessionHandler } from "./approve-session";

const createContext = (input: { id: string; body: { id: string; decision: "approve" | "deny" } }) => {
  const response: { status: number; body: unknown } = { status: 200, body: null };

  return {
    context: {
      req: {
        valid: (target: "param" | "json") => (target === "param" ? { id: input.id } : input.body),
      },
      json: (body: unknown, status: number) => {
        response.status = status;
        response.body = body;
        return response;
      },
    },
    response,
  };
};

describe("approveSessionHandler", () => {
  test("fires the session resume hook when awaiting input is approved", async () => {
    const updateStatus = mock(async () => ({ id: "session-1", project_id: "project-1", status: "in_progress" }));
    const listByProject = mock(async () => []);
    const getWorkspaceBySessionId = mock(async () => null);
    const handleResponse = mock(() => {});
    const deps = {
      sessionsService: {
        get: async () => ({ id: "session-1", project_id: "project-1", status: "awaiting_input" }),
        updateStatus,
      },
      sessionStore: {
        get: () => ({ approvalService: { handleResponse } }),
      },
      eventBus: {
        emit: () => {},
      },
      reposService: {
        listByProject,
      },
      workspaceSessionsService: {
        getWorkspaceBySessionId,
      },
    } as unknown as Parameters<typeof approveSessionHandler>[0];

    const handler = approveSessionHandler(deps);
    const { context, response } = createContext({ id: "session-1", body: { id: "approval-1", decision: "approve" } });
    await handler(context as never, undefined as never);

    expect(response.status).toBe(200);
    expect(handleResponse).toHaveBeenCalledWith({ id: "approval-1", decision: "approve" });
    expect(updateStatus).toHaveBeenCalledWith("session-1", "in_progress");

    for (let index = 0; index < 20; index += 1) {
      if (listByProject.mock.calls.length > 0) break;
      await Bun.sleep(10);
    }

    expect(getWorkspaceBySessionId).toHaveBeenCalledWith("session-1");
    expect(listByProject).toHaveBeenCalledWith("project-1");
  });
});
