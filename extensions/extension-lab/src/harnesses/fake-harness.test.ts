import { describe, expect, test } from "bun:test";
import type { HarnessContext, HarnessEventSink, JsonPatch } from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.extension-lab",
  name: "extension-lab",
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

const recordingSink = () => {
  const patches: JsonPatch[] = [];
  const sink: HarnessEventSink = { push: (patch) => patches.push(patch) };
  return { patches, sink };
};

describe("createFakeHarness", () => {
  test("emits canned patches on start and completes", async () => {
    const harness = createFakeHarness();
    const { patches, sink } = recordingSink();

    const session = await harness.start(ctx, { prompt: "Draft a release plan", sessionId: "host-1", events: sink });

    expect(typeof session.agentSessionId).toBe("string");
    expect(await session.done).toEqual({ status: "completed" });

    expect(patches.some((patch) => patch.path === "/messages/0")).toBe(true);
    expect(patches.some((patch) => patch.path === "/messages/1")).toBe(true);

    const messages = await harness.getMessages!(ctx, { agentSessionId: session.agentSessionId! });
    expect(messages.length).toBe(2);
    expect(messages[0]).toEqual({
      id: `${session.agentSessionId}-msg-0`,
      role: "user",
      parts: [{ type: "text", text: "Draft a release plan" }],
      index: 0,
    });
    expect(messages[1]?.role).toBe("assistant");
  });

  test("resolves cancelled when stopped before completion", async () => {
    const harness = createFakeHarness();
    const session = await harness.start(ctx, { prompt: "Slow", sessionId: "host-1", events: recordingSink().sink });

    await session.stop();

    expect(await session.done).toEqual({ status: "cancelled" });
  });

  test("appends resume patches at the provided messageOffset", async () => {
    const harness = createFakeHarness();
    const started = await harness.start(ctx, { prompt: "Initial", sessionId: "host-1", events: recordingSink().sink });
    await started.done;

    const { patches, sink } = recordingSink();
    const resumed = await harness.resume(ctx, {
      agentSessionId: started.agentSessionId!,
      sessionId: "host-1",
      prompt: "Continue",
      messageOffset: 2,
      events: sink,
    });
    await resumed.done;

    expect(patches[0]).toMatchObject({ op: "add", path: "/messages/2" });
    expect(patches[1]).toMatchObject({ op: "add", path: "/messages/3" });

    const messages = await harness.getMessages!(ctx, { agentSessionId: started.agentSessionId! });
    expect(messages).toHaveLength(4);
    expect(messages[2]).toMatchObject({ role: "user", index: 2 });
    expect(messages[3]).toMatchObject({ role: "assistant", index: 3 });
  });

  test("emits a question tool part for the question trigger prompt", async () => {
    const harness = createFakeHarness();

    const session = await harness.start(ctx, {
      prompt: "Please ask me a language __fake_question_prompt__",
      sessionId: "host-1",
      events: recordingSink().sink,
    });
    await session.done;

    const messages = await harness.getMessages!(ctx, { agentSessionId: session.agentSessionId! });
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: "assistant",
      parts: [
        {
          type: "tool",
          tool: "question",
          actionType: "execute",
          status: "completed",
          state: {
            input: {
              questions: [
                {
                  id: "language",
                  question: "Which language do you want to use?",
                  required: true,
                },
              ],
            },
          },
        },
      ],
    });
  });
});
