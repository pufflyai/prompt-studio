import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { persistSessionMessages } from "../../sessions/session-messages";
import { createSessionsApi } from "./sessions";

test("the scoped public fork copies a settled native conversation and rejects foreign identity without running it", async () => {
  let starts = 0;
  const messages = [
    { id: "answer", role: "assistant" as const, parts: [{ type: "text" as const, text: "Remember blue" }] },
  ];
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("fork", {
        provider: {
          cwdRequirement: "optional",
          start: () => {
            starts++;
            throw new Error("Fork cannot execute");
          },
          getMessages: () => messages,
          fork: (_ctx, input) => {
            expect(input.messageId).toBe("answer");
            return { agentSessionId: "independent" };
          },
        },
      }),
    ]),
  });
  try {
    const project = await handle.deps.projectService.create({ name: "Public fork" });
    const workspace = await handle.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project" });
    const source = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Source",
      agent: testHarnessId("fork"),
      status: "completed",
    });
    await handle.deps.sessionService.update(source.id, {
      agent_session_id: "original",
      last_selected_model: "saved",
      params_json: { thinking: "high" },
    });
    await handle.deps.workspaceSessionService.link(workspace.id, source.id);
    await persistSessionMessages(source.id, messages, handle.deps);
    const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "PF" } });
    expect(await api.getForkState(source.id)).toEqual({ supported: true, disabledReason: null });
    const fork = await api.fork(source.id, "answer");
    expect(fork).toMatchObject({
      originalSessionId: source.id,
      workspaceId: workspace.id,
      status: "completed",
      lastSelectedModel: "saved",
    });
    expect((await api.get(fork.id))?.agentSessionId).toBe("independent");
    expect((await api.getConversation(fork.id)).messages).toEqual(messages);
    expect(starts).toBe(0);
    const foreign = await handle.deps.projectService.create({ name: "Foreign" });
    const other = createSessionsApi(handle.deps, { projectId: foreign.id, project: { ...foreign, shorthand: "F" } });
    await expect(other.fork(source.id, "answer")).rejects.toThrow("Session not found");
    await handle.deps.sessionService.transitionStatus(source.id, "in_progress");
    expect((await api.getForkState(source.id)).disabledReason).toContain("pending work");
    await expect(api.fork(source.id, "answer")).rejects.toThrow("pending work");
  } finally {
    await handle.close();
  }
});
