import { afterEach, expect, test } from "bun:test";
import { prepareCodexOperation } from "./commands";
import { createGoalCommandPeer } from "./goal-command-peer";

const peers: ReturnType<typeof createGoalCommandPeer>[] = [];
afterEach(async () => {
  for (const peer of peers.splice(0)) await peer.runtime.dispose();
});
const setup = async () => {
  const peer = createGoalCommandPeer();
  peers.push(peer);
  const run = await peer.runtime.run(peer.input);
  const context = { sessionId: "host-session", agentSessionId: run.agentSessionId };
  return { ...peer, run, context };
};

test("a submitted goal attaches to the active turn and retains autonomous continuation before acknowledgement", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  expect(prepared.execution).toBe("control");
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  let finished = false;
  void peer.run.done.then(() => {
    finished = true;
  });
  await Bun.sleep(1);
  expect(finished).toBe(false);
  peer.notifyGoal("active");
  peer.replyGoal(peer.goal("active"));
  expect(await invoked).toMatchObject({ kind: "completed" });
  peer.startNext();
  peer.answerNext();
  peer.complete("next");
  peer.notifyGoal("complete");
  expect(await peer.run.done).toEqual({ status: "completed" });
  expect(peer.calls.filter((call) => call.method === "turn/start")).toHaveLength(1);
  expect(peer.calls.find((call) => call.method === "thread/goal/set")?.params).toMatchObject({
    threadId: peer.run.agentSessionId,
    objective: "New objective",
    status: "active",
  });
  expect(JSON.stringify(peer.messages)).toContain("Following the new goal");
});

test("a prepared live goal does not mutate a completed owner and an explicit retry becomes exclusive", async () => {
  const peer = await setup();
  const operation = { kind: "command" as const, text: "/goal New objective" };
  const prepared = prepareCodexOperation(peer.context, operation, peer.runtime);
  expect(prepared.execution).toBe("control");
  peer.complete();
  await peer.run.done;
  await expect(prepared.invoke({ events: peer.events })).rejects.toThrow("finished");
  expect(peer.calls.some((call) => call.method === "thread/goal/set")).toBe(false);
  expect(prepareCodexOperation(peer.context, operation, peer.runtime).execution).toBe("exclusive");
});

test("explicit goal rejection releases the current turn after it completes", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  expect(prepared.execution).toBe("control");
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  peer.rejectGoal();
  await expect(invoked).rejects.toThrow("Goal rejected");
  expect(await peer.run.done).toEqual({ status: "completed" });
});

test("a lost goal acknowledgement disconnects the owner without replaying the mutation", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  expect(prepared.execution).toBe("control");
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.kill();
  await expect(invoked).rejects.toThrow("closed");
  expect(await peer.run.done).toEqual({ status: "disconnected" });
  expect(peer.run.agentSessionId).toBe("native-thread");
  expect(peer.calls.filter((call) => call.method === "thread/goal/set")).toHaveLength(1);
});

test.each([
  "paused",
  null,
] as const)("a queued old goal state %s does not override the later native acknowledgement", async (status) => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  peer.notifyGoal(status);
  peer.replyGoal(peer.goal("active"));
  await invoked;
  let finished = false;
  void peer.run.done.then(() => {
    finished = true;
  });
  await Bun.sleep(1);
  expect(finished).toBe(false);
  peer.startNext();
  peer.complete("next");
  peer.notifyGoal("complete");
  expect(await peer.run.done).toEqual({ status: "completed" });
});

test.each([
  "paused",
  null,
] as const)("a native goal state %s after acknowledgement takes precedence", async (status) => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  peer.replyGoal(peer.goal("active"));
  peer.notifyGoal(status);
  await invoked;
  expect(await peer.run.done).toEqual({ status: "completed" });
});

test("Stop between autonomous goal turns reports cancellation", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.replyGoal(peer.goal("active"));
  await invoked;
  peer.complete();
  const stopped = peer.run.stop();
  peer.notifyGoal("paused");
  peer.replyGoal(peer.goal("paused"));
  await stopped;
  expect(await peer.run.done).toEqual({ status: "cancelled" });
});

test("aborting a pending goal update retires its operation and releases the control", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const abort = new AbortController();
  const invoked = prepared.invoke({ events: peer.events, signal: abort.signal });
  await peer.requested;
  abort.abort();
  await expect(invoked).rejects.toThrow("closed");
  expect(await peer.run.done).toEqual({ status: "disconnected" });
});

test.each([
  "failed",
  "interrupted",
])("a %s owner cannot leave accepted goal work running without an owner", async (status) => {
  const peer = await setup();
  const worker = peer.runtime.worker(peer.input);
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete("first", status);
  expect(await peer.run.done).toEqual({ status: status === "failed" ? "failed" : "cancelled" });
  peer.replyGoal(peer.goal("active"));
  await expect(invoked).rejects.toThrow("ended");
  expect(worker.isClosed()).toBe(true);
});

test("editing an active goal uses the same owner and preserves its native status", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(
    peer.context,
    {
      kind: "mode-action",
      modeId: "goal",
      actionId: "edit",
      argument: "Edited objective",
    },
    peer.runtime,
  );
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  peer.replyGoal(peer.goal("paused"));
  await invoked;
  expect(await peer.run.done).toEqual({ status: "completed" });
  expect(peer.calls.find((call) => call.method === "thread/goal/set")?.params).toEqual({
    threadId: "native-thread",
    objective: "Edited objective",
  });
});

test("a question keeps its native turn identity when a pending goal delays operation completion", async () => {
  const peer = await setup();
  peer.question();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.complete();
  peer.replyGoal(peer.goal("paused"));
  await invoked;
  await peer.run.done;
  const questions = peer.messages.flatMap((message) => message.parts).filter((part) => part.type === "tool");
  expect(questions).toHaveLength(1);
  expect(questions[0]).toMatchObject({ callId: "question", status: "failed" });
});

test("a live goal update does not replace the pending native user message", async () => {
  const peer = await setup();
  const prepared = prepareCodexOperation(peer.context, { kind: "command", text: "/goal New objective" }, peer.runtime);
  const invoked = prepared.invoke({ events: peer.events });
  await peer.requested;
  peer.replyGoal(peer.goal("active"));
  await invoked;
  peer.userFirst();
  const texts = peer.messages.filter((message) => message.role === "user").map((message) => message.parts[0]);
  expect(texts).toEqual([
    { type: "text", text: "Current task" },
    { type: "text", text: "/goal New objective" },
  ]);
});
