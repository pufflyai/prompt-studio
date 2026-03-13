import { describe, expect, test } from "bun:test";
import { createEventStore } from "../../services/event-store";
import { createFakeAgent } from "./fake-agent";

describe("createFakeAgent", () => {
  test("emits canned patches on start and exits successfully", async () => {
    const eventStore = createEventStore();
    const agent = createFakeAgent();

    const result = await agent.startSession({
      prompt: "Draft a release plan",
      eventStore,
    });

    expect(typeof result.sessionId).toBe("string");
    expect(result.process).toBeDefined();

    const exit = await result.process!.onExit;
    expect(exit).toEqual({ code: 0, signal: null });

    const patches = eventStore.getHistory();
    expect(patches.some((patch) => patch.path === "/messages/0")).toBe(true);
    expect(patches.some((patch) => patch.path === "/messages/1")).toBe(true);

    const messages = await agent.getMessages(result.sessionId);
    expect(messages.length).toBe(2);
    expect(messages[0]).toEqual({
      id: `${result.sessionId}-msg-0`,
      role: "user",
      parts: [{ type: "text", text: "Draft a release plan" }],
      index: 0,
    });
    expect(messages[1]?.role).toBe("assistant");

    eventStore.close();
  });

  test("appends resume patches at the provided messageOffset", async () => {
    const agent = createFakeAgent();
    const startStore = createEventStore();
    const started = await agent.startSession({ prompt: "Initial", eventStore: startStore });
    await started.process!.onExit;
    startStore.close();

    const resumeStore = createEventStore();
    const resumed = await agent.resumeSession(
      { sessionId: started.sessionId, prompt: "Continue", messageOffset: 2 },
      resumeStore,
    );
    await resumed.process!.onExit;

    const patches = resumeStore.getHistory();
    expect(patches[0]).toMatchObject({ op: "add", path: "/messages/2" });
    expect(patches[1]).toMatchObject({ op: "add", path: "/messages/3" });

    const messages = await agent.getMessages(started.sessionId);
    expect(messages).toHaveLength(4);
    expect(messages[2]).toMatchObject({ role: "user", index: 2 });
    expect(messages[3]).toMatchObject({ role: "assistant", index: 3 });

    resumeStore.close();
  });
});
