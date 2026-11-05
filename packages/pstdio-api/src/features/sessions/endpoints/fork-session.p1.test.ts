import { expect, test } from "bun:test";
import type { SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { forkSession } from "../fork-session";
import { persistSessionMessages } from "../session-messages";

const history: SessionMessage[] = [
  { id: "question", role: "user", parts: [{ type: "text", text: "Remember blue" }] },
  { id: "answer", role: "assistant", parts: [{ type: "text", text: "Blue it is" }] },
];

test("fork preserves history and settings while follow-ups use a separate native conversation", async () => {
  const fullHistory: SessionMessage[] = [
    ...history,
    { id: "later-question", role: "user", parts: [{ type: "text", text: "Remember red too" }] },
    { id: "later-answer", role: "assistant", parts: [{ type: "text", text: "Red too" }] },
  ];
  const native = new Map([["original", structuredClone(fullHistory)]]);
  const resumed: string[] = [];
  let starts = 0;
  const harness = createTestHarnessRecord("fork", {
    provider: {
      start: () => {
        starts++;
        throw new Error("Forking must not run the model");
      },
      fork: (_ctx, input) => {
        expect(input.messageId).toBe(input.agentSessionId === "original" ? "answer" : "fork-answer");
        const source = native.get(input.agentSessionId!)!;
        const nativeId = input.agentSessionId === "original" ? "forked" : "forked-again";
        native.set(
          nativeId,
          structuredClone(source.slice(0, source.findIndex((message) => message.id === input.messageId) + 1)).map(
            (message) => ({ ...message, id: `fork-${message.id}` }),
          ),
        );
        return { agentSessionId: nativeId };
      },
      getMessages: (_ctx, input) => native.get(input.agentSessionId)!,
      resume: (_ctx, input) => {
        resumed.push(input.agentSessionId);
        const message: SessionMessage = {
          id: crypto.randomUUID(),
          role: "user",
          parts: [{ type: "text", text: input.prompt }],
        };
        native.get(input.agentSessionId)!.push(message);
        input.events.push({ op: "add", path: `/messages/${input.messageOffset}`, value: message });
        return { agentSessionId: input.agentSessionId, done: Promise.resolve({ status: "completed" }), stop: () => {} };
      },
    },
  });
  const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  try {
    const projectResponse = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Forks" })),
    });
    const project = (await projectResponse.json()) as { id: string };
    const response = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: project.id, title: "Explore", agent: testHarnessId("fork") }),
    });
    expect(response.status).toBe(201);
    const source = (await response.json()) as { id: string; workspaceId: string };
    await handle.deps.sessionService.update(source.id, {
      agent_session_id: "original",
      last_selected_model: "chosen-model",
      params_json: { effort: "high" },
    });
    await persistSessionMessages(source.id, fullHistory, handle.deps);
    const forkResponse = await handle.app.request(`/v1/sessions/${source.id}/fork?messageId=answer`, {
      method: "POST",
    });
    expect(forkResponse.status).toBe(201);
    const fork = (await forkResponse.json()) as { id: string; sessionFileId: string };
    expect(fork).toMatchObject({
      title: "Explore (fork)",
      originalSessionId: source.id,
      workspaceId: source.workspaceId,
      agentSessionId: "forked",
      agent: testHarnessId("fork"),
      lastSelectedModel: "chosen-model",
      status: "completed",
    });
    expect(fork.id).not.toBe(source.id);
    expect(starts).toBe(0);
    expect((await handle.deps.sessionService.get(fork.id))?.params_json).toEqual({ effort: "high" });
    expect((await handle.deps.sessionService.get(fork.id))?.session_file_id).not.toBe(
      (await handle.deps.sessionService.get(source.id))?.session_file_id,
    );
    const conversation = await handle.app.request(`/v1/sessions/${fork.id}/conversation`);
    expect(((await conversation.json()) as { messages: SessionMessage[] }).messages).toEqual(
      history.map((message) => ({ ...message, id: `fork-${message.id}` })),
    );
    const again = await handle.app.request(`/v1/sessions/${fork.id}/fork?messageId=fork-answer`, { method: "POST" });
    expect(again.status).toBe(201);
    expect(native.get("forked-again")).toHaveLength(2);
    // Use the public follow-up path; shared native IDs would silently mutate both branches.
    await handle.deps.sessionService.update(fork.id, { params_json: {} });
    const followUp = await handle.app.request(`/v1/sessions/${fork.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Try green" }),
    });
    expect(followUp.status).toBe(200);
    for (let i = 0; i < 100 && (await handle.deps.sessionService.get(fork.id))?.status !== "completed"; i++)
      await Bun.sleep(10);
    expect(resumed).toEqual(["forked"]);
    expect(native.get("original")).toEqual(fullHistory);
    expect(native.get("forked")).toHaveLength(3);
  } finally {
    await handle.close();
  }
});

test("forks an earlier reply without stopping the source run or consuming pending work", async () => {
  const native = new Map([["original", structuredClone(history)]]);
  let stopped = false;
  const running = Promise.withResolvers<{ status: "completed" }>();
  const harness = createTestHarnessRecord("fork", {
    provider: {
      fork: (_ctx, input) => {
        expect(input.messageId).toBe("answer");
        const messages = native.get(input.agentSessionId!)!;
        native.set(
          "forked",
          structuredClone(messages.slice(0, messages.findIndex((m) => m.id === input.messageId) + 1)),
        );
        return { agentSessionId: "forked" };
      },
      getMessages: (_ctx, input) => native.get(input.agentSessionId)!,
    },
  });
  const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  try {
    const project = await handle.deps.projectService.create({ name: "Running fork" });
    const workspace = await handle.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Workspace",
      root_path: "/tmp/running-fork-workspace",
    });
    const source = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Source",
      agent: testHarnessId("fork"),
      status: "in_progress",
    });
    await handle.deps.sessionService.update(source.id, { agent_session_id: "original" });
    await handle.deps.workspaceSessionService.link(workspace.id, source.id);
    const owner = handle.deps.sessionService.store.create(source.id, {
      onApprovalRequest() {},
      onQuestionAsked() {},
      onQuestionAnswered() {},
    });
    const conversation = await owner.conversationReady;
    const later: SessionMessage = { id: "later", role: "user", parts: [{ type: "text", text: "Keep working" }] };
    conversation.push({ op: "replace", path: "/messages", value: [...history, later] });
    native.get("original")!.push(later);
    const run = {
      agentSessionId: "original",
      done: running.promise,
      stop: () => {
        stopped = true;
      },
    };
    handle.deps.sessionService.store.setSession(source.id, run);
    await handle.deps.sessionQueueEntriesService.createSteeringDelivery(
      { session_id: source.id, prompt: "Unconfirmed correction", request_kind: "follow_up" },
      { id: "delivery", runStartedAt: new Date().toISOString() },
    );
    await handle.deps.sessionQueueEntriesService.create({
      session_id: source.id,
      prompt: "Queued follow-up",
      request_kind: "follow_up",
    });
    const before = await handle.deps.sessionQueueEntriesService.listUndispatchedBySession(source.id);
    expect(before).toHaveLength(2);
    const invalid = await handle.app.request(`/v1/sessions/${source.id}/fork?messageId=later`, { method: "POST" });
    expect(invalid.status).toBe(400);
    const partial: SessionMessage = {
      id: "partial",
      role: "assistant",
      parts: [{ type: "text", text: "Working on it" }],
    };
    conversation.push({ op: "add", path: "/messages/3", value: partial });
    native.get("original")!.push(partial);
    const unsettled = await handle.app.request(`/v1/sessions/${source.id}/fork?messageId=partial`, { method: "POST" });
    expect(unsettled.status).toBe(409);
    const response = await handle.app.request(`/v1/sessions/${source.id}/fork?messageId=answer`, { method: "POST" });
    expect(response.status).toBe(201);
    const fork = (await response.json()) as { id: string; status: string; agentSessionId: string };
    expect(fork).toMatchObject({ status: "completed", agentSessionId: "forked" });
    expect(fork.id).not.toBe(source.id);
    expect(await handle.deps.sessionQueueEntriesService.listUndispatchedBySession(source.id)).toEqual(before);
    expect(handle.deps.sessionService.store.get(source.id)).toBe(owner);
    expect(owner.session).toBe(run);
    expect(stopped).toBe(false);
    expect((await handle.deps.sessionService.get(source.id))?.status).toBe("in_progress");
    expect(conversation.getMessages()).toEqual([...history, later, partial]);
    expect(native.get("original")).toEqual([...history, later, partial]);
    const copied = await handle.app.request(`/v1/sessions/${fork.id}/conversation`);
    expect(((await copied.json()) as { messages: SessionMessage[] }).messages).toEqual(history);
  } finally {
    running.resolve({ status: "completed" });
    await handle.close();
  }
});

test("fork rejects missing sessions and work that has not settled", async () => {
  const handle = await createTestApp();
  try {
    expect((await handle.app.request("/v1/sessions/missing/fork", { method: "POST" })).status).toBe(404);
    const project = await handle.deps.projectService.create({ name: "Busy fork" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Running",
      agent: testHarnessId("fake"),
      status: "in_progress",
    });
    expect((await handle.app.request(`/v1/sessions/${session.id}/fork`, { method: "POST" })).status).toBe(409);
    await handle.deps.sessionService.transitionStatus(session.id, "completed");
    await handle.deps.sessionQueueEntriesService.createSteeringDelivery(
      { session_id: session.id, prompt: "Unconfirmed correction", request_kind: "follow_up" },
      { id: "delivery", runStartedAt: new Date().toISOString() },
    );
    expect((await handle.app.request(`/v1/sessions/${session.id}/fork`, { method: "POST" })).status).toBe(409);
  } finally {
    await handle.close();
  }
});

test.each([
  "native copying",
  "checkpoint persistence",
])("a workspace removed during %s cannot receive a new fork", async (phase) => {
  const copying = Promise.withResolvers<void>();
  const copied = Promise.withResolvers<void>();
  const harness = createTestHarnessRecord("fork", {
    provider: {
      fork: async () => {
        if (phase === "native copying") {
          copying.resolve();
          await copied.promise;
        }
        return { agentSessionId: "new-native" };
      },
    },
  });
  const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([harness]) });
  if (phase === "checkpoint persistence") {
    const upload = handle.deps.fileService.upload;
    handle.deps.fileService.upload = async (input) => {
      copying.resolve();
      await copied.promise;
      return upload(input);
    };
  }
  try {
    const project = await handle.deps.projectService.create({ name: "Removed workspace" });
    const workspace = await handle.deps.workspaceService.createStandalone({
      project_id: project.id,
      name: "Worktree",
      branch: "experiment",
      root_path: "/tmp/fork-workspace",
    });
    const source = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Source",
      agent: testHarnessId("fork"),
      status: "completed",
    });
    await handle.deps.sessionService.update(source.id, { agent_session_id: "original" });
    await handle.deps.workspaceSessionService.link(workspace.id, source.id);
    const pending = forkSession(handle.deps, source.id);
    const outcome = pending.then(
      () => "created",
      (error: Error) => error.message,
    );
    await copying.promise;
    await handle.deps.workspaceService.softDelete(workspace.id);
    copied.resolve();
    expect(await outcome).toBe("The workspace is not ready.");
    expect(await handle.deps.sessionService.list(project.id)).toHaveLength(1);
  } finally {
    copied.resolve();
    await handle.close();
  }
});
