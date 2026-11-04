import { expect, test } from "bun:test";
import type { HarnessExit } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createDeviceCommandExecutor } from "./device-command-executor";

test("a remote interrupt stops only the target turn, preserves history and refuses another project's session", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Remote commands" });
    const other = await app.deps.projectService.create({ name: "Local private project" });
    const sessions = app.deps.sessionService;
    const target = await sessions.create({ project_id: project.id, title: "Target", agent: "fixture.agent" });
    const unrelated = await sessions.create({ project_id: project.id, title: "Unrelated", agent: "fixture.agent" });
    const privateSession = await sessions.create({ project_id: other.id, title: "Private", agent: "fixture.agent" });
    const stops: string[] = [];
    for (const session of [target, unrelated, privateSession]) {
      const entry = sessions.store.create(session.id, {
        onApprovalRequest: () => {},
        onQuestionAsked: () => {},
        onQuestionAnswered: () => {},
      });
      sessions.store.setSession(
        session.id,
        {
          agentSessionId: `native-${session.id}`,
          done: new Promise<HarnessExit>(() => {}),
          stop: () => {
            stops.push(session.id);
          },
        },
        entry,
      );
      entry.conversation!.push({
        op: "add",
        path: "/messages/0",
        value: { id: "history", role: "user", parts: [{ type: "text", text: "Keep this conversation" }] },
      });
    }
    const execute = createDeviceCommandExecutor(app.deps, project.id);
    const signal = new AbortController().signal;
    expect(await execute({ type: "session.interrupt", id: privateSession.id }, { signal })).toMatchObject({
      status: 404,
    });
    expect(stops).toEqual([]);
    const interrupted = await execute({ type: "session.interrupt", id: target.id }, { signal });
    expect(interrupted).toMatchObject({ status: 200, body: { id: target.id, status: "cancelled" } });
    expect(stops).toEqual([target.id]);
    expect(await sessions.get(unrelated.id)).toMatchObject({ status: "in_progress" });
    expect(sessions.store.get(unrelated.id)).not.toBeNull();
    expect(await sessions.get(target.id)).not.toBeNull();
    expect(sessions.store.get(target.id)?.conversation?.getMessages()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "history" })]),
    );
    await expect(execute({ type: "machine.stop" }, { signal })).rejects.toThrow();
    expect(stops).toEqual([target.id]);
  } finally {
    await app.close();
  }
});

test("a relay call that is already cancelled does not interrupt a turn", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Cancelled call" });
    const session = await app.deps.sessionService.create({
      project_id: project.id,
      title: "Running",
      agent: "fixture.agent",
    });
    const controller = new AbortController();
    controller.abort(new Error("Relay disconnected"));
    await expect(
      createDeviceCommandExecutor(app.deps, project.id)(
        { type: "session.interrupt", id: session.id },
        { signal: controller.signal },
      ),
    ).rejects.toThrow("Relay disconnected");
    expect(await app.deps.sessionService.get(session.id)).toMatchObject({ status: "in_progress" });
  } finally {
    await app.close();
  }
});
