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
  let forks = 0;
  const controlEntered = Promise.withResolvers<void>();
  const releaseControl = Promise.withResolvers<void>();
  let pendingControl: Promise<unknown> | undefined;
  let sourceId: string | undefined;
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
          prepareOperation: () => ({
            execution: "control",
            invoke: async () => {
              controlEntered.resolve();
              await releaseControl.promise;
              return { kind: "completed" };
            },
          }),
          fork: (_ctx, input) => {
            expect(input.messageId).toBe("answer");
            return { agentSessionId: `independent-${++forks}` };
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
    sourceId = source.id;
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
    expect((await api.get(fork.id))?.agentSessionId).toBe("independent-1");
    expect((await api.getConversation(fork.id)).messages).toEqual(messages);
    expect(starts).toBe(0);
    const foreign = await handle.deps.projectService.create({ name: "Foreign" });
    const other = createSessionsApi(handle.deps, { projectId: foreign.id, project: { ...foreign, shorthand: "F" } });
    await expect(other.fork(source.id, "answer")).rejects.toThrow("Session not found");
    // Keep a real public control owner alive across both reads; an ownerless status can recover to settled.
    pendingControl = api.invokeHarnessOperation(source.id, { kind: "command", text: "/status" });
    await Promise.race([
      controlEntered.promise,
      pendingControl.then(() => {
        throw new Error("The control finished before its busy assertions.");
      }),
    ]);
    expect((await api.getForkState(source.id)).disabledReason).toContain("pending work");
    await expect(api.fork(source.id)).rejects.toThrow("pending work");
    expect(await api.getForkState(source.id, { scope: "reply" })).toEqual({ supported: true, disabledReason: null });
    await expect(api.fork(source.id, "answer")).rejects.toThrow("completed agent reply");
    const owner = handle.deps.sessionService.store.get(source.id)!;
    const conversation = await owner.conversationReady;
    conversation.push({
      op: "add",
      path: "/messages/1",
      value: { id: "later", role: "user", parts: [{ type: "text", text: "Later work" }] },
    });
    conversation.push({
      op: "add",
      path: "/messages/2",
      value: { id: "partial", role: "assistant", parts: [{ type: "text", text: "Still working" }] },
    });
    const earlier = await api.fork(source.id, "answer");
    expect(earlier.status).toBe("completed");
    expect(handle.deps.sessionService.store.get(source.id)).toBe(owner);
    await expect(api.fork(source.id, "partial")).rejects.toThrow("completed agent reply");
  } finally {
    releaseControl.resolve();
    try {
      await pendingControl;
      // The operation acknowledgement precedes its host checkpoint. Finish owned work before closing its database.
      for (let i = 0; i < 100 && sourceId && handle.deps.sessionService.store.get(sourceId); i++) await Bun.sleep(10);
      if (sourceId) expect(handle.deps.sessionService.store.get(sourceId)).toBeNull();
    } finally {
      await handle.close();
    }
  }
});
