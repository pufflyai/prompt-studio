import { expect, spyOn, test } from "bun:test";
import { createDeviceCommandExecutor } from "../../../services/relay/device-command-executor";
import { createTestApp } from "../../../test-utils/create-test-app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";
import { inertSessionChannelHooks } from "../../sessions/session-store.test-utils";
import { createSessionsApi } from "./sessions";

test("public session controls relay online-owner queue, question, approval, follow-up and stop without local execution", async () => {
  const source = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("remote")]),
  });
  const reader = await createTestApp();
  const restore: Array<() => void> = [];
  try {
    const project = await source.deps.projectService.create({ name: "Remote owner" });
    await reader.deps.projectService.create({ id: project.id, name: project.name });
    const session = await source.deps.sessionService.create({
      project_id: project.id,
      title: "Remote",
      agent: testHarnessId("remote"),
    });
    const device = { id: "laptop", name: "Laptop", ownerId: "owner" };
    const personal = spyOn(reader.deps.personalHistoryService, "getSession").mockImplementation(
      async (id, projectId) =>
        id === session.id && (!projectId || projectId === project.id)
          ? { ...session, workspace_id: null, device, approval_requests: [] }
          : null,
    );
    restore.push(() => personal.mockRestore());
    const execute = createDeviceCommandExecutor(source.deps, project.id);
    const sent: string[] = [];
    const send = spyOn(reader.deps.accountService, "sendDeviceCommand").mockImplementation(
      async (projectId, deviceId, command, signal) => {
        expect([projectId, deviceId]).toEqual([project.id, device.id]);
        sent.push(command.type);
        return execute(JSON.parse(JSON.stringify(command)), { signal });
      },
    );
    restore.push(() => send.mockRestore());
    const api = createSessionsApi(reader.deps, { projectId: project.id, project: { ...project, shorthand: "RO" } });
    const entry = source.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    const answers: unknown[] = [];
    let stops = 0;
    source.deps.sessionService.store.setSession(session.id, {
      done: new Promise(() => {}),
      stop: () => {
        stops++;
      },
      replyQuestion: async (answer) => {
        answers.push(answer);
      },
    });
    await api.followup({ sessionId: session.id, questionResponse: { callId: "question", answers: [["Blue"]] } });
    expect(answers).toEqual([{ callId: "question", answers: [["Blue"]] }]);
    const approval = entry.approvalService.requestApproval({
      id: "approval",
      toolName: "write",
      toolUseId: "write",
      toolInput: {},
    });
    await api.approve(session.id, { id: "approval", decision: "deny" });
    expect(await approval).toMatchObject({ decision: "deny" });
    await source.deps.sessionService.insertEntryForActive({
      id: session.id,
      prompt: "Queued",
      request_kind: "follow_up",
    });
    const queued = (await api.getQueuedFollowUps(session.id)).requests[0];
    expect((await api.getQueuedMessages(session.id)).queue?.requests[0].prompt).toBe("Queued");
    const updated = await api.updateQueuedFollowUp(session.id, queued.queuePosition, {
      prompt: "Edited",
      expectedRevision: queued.revision,
    });
    expect(updated.prompt).toBe("Edited");
    await expect(api.removeQueuedFollowUp(session.id, queued.queuePosition, queued.revision)).rejects.toThrow();
    await api.removeQueuedFollowUp(session.id, updated.queuePosition, updated.revision);
    const hold = await api.retainResources(session.id);
    hold.close();
    hold.close();
    expect(reader.deps.sessionService.store.get(session.id)).toBeNull();
    expect(await reader.deps.sessionService.get(session.id)).toBeNull();
    await api.followup({ sessionId: session.id, prompt: "Follow up on Laptop" });
    expect((await source.deps.sessionQueueEntriesService.listPendingBySession(session.id)).length).toBeGreaterThan(0);
    await api.stop(session.id);
    expect(stops).toBe(1);
    expect(sent).toContain("session.followUp");
    expect(sent).toContain("session.interrupt");
    const foreign = await reader.deps.projectService.create({ name: "Foreign" });
    const other = createSessionsApi(reader.deps, { projectId: foreign.id, project: { ...foreign, shorthand: "F" } });
    const before = sent.length;
    await expect(other.stop(session.id)).rejects.toThrow("Session not found");
    expect(sent).toHaveLength(before);
  } finally {
    for (const undo of restore) undo();
    await reader.close();
    await source.close();
  }
});

test("local execution availability needs no account device; remote history requires a matching online owner", async () => {
  const handle = await createTestApp();
  const restore: Array<() => void> = [];
  try {
    const project = await handle.deps.projectService.create({ name: "Availability" });
    const local = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Local",
      agent: "test.agent",
    });
    const api = createSessionsApi(handle.deps, { projectId: project.id, project: { ...project, shorthand: "AV" } });
    const remote = {
      ...local,
      id: "remote",
      device: { ownerId: "owner", id: "laptop", name: "Laptop" },
      workspace_id: null,
      approval_requests: [],
    };
    const personal = spyOn(handle.deps.personalHistoryService, "getSession").mockImplementation(async (id) =>
      id === remote.id ? remote : null,
    );
    restore.push(() => personal.mockRestore());
    expect(await api.getExecutionState(local.id)).toEqual({ kind: "local", available: true });
    expect(await api.getExecutionState(remote.id)).toMatchObject({ kind: "remote", available: false });
    const status = spyOn(handle.deps.accountService, "status").mockResolvedValue({
      login: {
        accountId: "owner",
        deviceId: "here",
        managerOrigin: "https://manager.test",
        relayOrigin: "https://relay.test",
      },
      features: null,
      cloudProjects: [],
      cloudProjectsLoaded: true,
    });
    const devices = spyOn(handle.deps.accountService, "devices").mockResolvedValue([]);
    restore.push(
      () => status.mockRestore(),
      () => devices.mockRestore(),
    );
    expect(await api.getExecutionState(local.id)).toEqual({ kind: "local", available: true });
    expect(await api.getExecutionState(remote.id)).toMatchObject({ available: false });
    devices.mockResolvedValue([
      { id: "laptop", name: "Laptop", online: true, current: false, platform: "test", createdAt: "", lastSeenAt: "" },
    ]);
    expect(await api.getExecutionState(remote.id)).toMatchObject({ kind: "remote", available: true });
    devices.mockRejectedValue(new Error("Unavailable"));
    expect(await api.getExecutionState(remote.id)).toMatchObject({ available: false });
    expect(await api.getExecutionState(local.id)).toEqual({ kind: "local", available: true });
  } finally {
    for (const undo of restore) undo();
    await handle.close();
  }
});
