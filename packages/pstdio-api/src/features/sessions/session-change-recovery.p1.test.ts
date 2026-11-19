import { expect, test } from "bun:test";
import type { HarnessExit, SessionMessage } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { initializeConversation } from "./initialize-conversation";
import { checkpointConversation } from "./session-checkpoint";
import { latestReply, persistSessionMessages } from "./session-messages";
import { reattachAgentSession } from "./spawn-agent";

const reply = (id: string, text: string): SessionMessage => ({
  id,
  role: "assistant",
  parts: [{ type: "text", text }],
});

for (const alreadyComplete of [false, true]) {
  test(`orphan recovery publishes its completed reply when native history was ${alreadyComplete ? "already complete" : "partial under the same ID"}`, async () => {
    const initial = [reply("new", alreadyComplete ? "Complete answer" : "Partial")];
    const completed = [reply("new", "Complete answer")];
    const exit = Promise.withResolvers<HarnessExit>();
    const record = createTestHarnessRecord("recovery", {
      provider: {
        cwdRequirement: "optional",
        capabilities: () => ["SessionReattach"],
        getMessages: () => initial,
        recoverMessages: () => ({ kind: "recovered", messages: initial }),
        reattach: (_ctx, input) => {
          input.events.push({ op: "replace", path: "/messages", value: completed });
          return { done: exit.promise, stop: () => exit.resolve({ status: "cancelled" }) };
        },
      },
    });
    const handle = await createTestApp({ harnessRegistry: createTestHarnessRegistry([record]) });
    try {
      const project = await handle.deps.projectService.create({ name: "Recovered positions" });
      const session = await handle.deps.sessionService.create({
        project_id: project.id,
        title: "Recovery",
        agent: testHarnessId("recovery"),
      });
      await handle.deps.sessionService.update(session.id, { agent_session_id: "native" });
      const previous = [reply("old", "Previous committed turn")];
      await persistSessionMessages(session.id, previous, handle.deps, latestReply(previous));
      await reattachAgentSession(
        { sessionId: session.id, agentSessionId: "native", agentId: testHarnessId("recovery"), projectId: project.id },
        handle.deps,
      );
      exit.resolve({ status: "completed" });
      for (let i = 0; i < 200 && (await handle.deps.sessionService.get(session.id))?.status !== "completed"; i++)
        await Bun.sleep(5);
      const saved = await handle.deps.sessionService.get(session.id);
      expect(saved?.status).toBe("completed");
      expect(saved?.change_positions?.reply).toMatchObject({ ...latestReply(completed), position: 2 });
    } finally {
      exit.resolve({ status: "cancelled" });
      await handle.close();
    }
  });
}

test("normal continuation advances a same-ID finalized correction but leaves unchanged historical content quiet", async () => {
  const handle = await createTestApp();
  try {
    const project = await handle.deps.projectService.create({ name: "Same reply" });
    const session = await handle.deps.sessionService.create({ project_id: project.id, title: "Resume", agent: "test" });
    const before = [reply("same", "Before")];
    await persistSessionMessages(session.id, before, handle.deps);
    const idle = initializeConversation(session.id, handle.deps, async () => {});
    await idle.conversationReady;
    await checkpointConversation(session.id, idle, handle.deps, true);
    expect((await handle.deps.sessionService.get(session.id))?.change_positions).toBeNull();
    const changed = initializeConversation(session.id, handle.deps, async () => {});
    const conversation = await changed.conversationReady;
    const after = [reply("same", "After")];
    conversation.push({ op: "replace", path: "/messages", value: after });
    await checkpointConversation(session.id, changed, handle.deps, true);
    expect((await handle.deps.sessionService.get(session.id))?.change_positions?.reply).toMatchObject({
      ...latestReply(after),
      position: 1,
    });
  } finally {
    await handle.close();
  }
});
