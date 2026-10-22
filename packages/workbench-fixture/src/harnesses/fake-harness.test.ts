import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  HarnessContext,
  HarnessEventSink,
  HarnessSession,
  JsonPatch,
  SessionMessage,
} from "@pstdio/sdk/extensions";
import { createFakeHarness } from "./fake-harness";

const ctx: HarnessContext = {
  extensionId: "pstdio.workbench-fixture",
  name: "workbench-fixture",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const recordingSink = (initial: SessionMessage[] = []) => {
  const patches: JsonPatch[] = [];
  const messages = [...initial];
  const sink: HarnessEventSink = {
    push: (patch) => {
      patches.push(patch);
      const index = Number(patch.path.slice("/messages/".length));
      messages[index] = patch.value as SessionMessage;
    },
    getMessages: () => messages,
  };
  return { patches, sink };
};

describe("createFakeHarness", () => {
  test("keeps async native questions owned until each reply is delivered", async () => {
    const harness = createFakeHarness();
    const { sink } = recordingSink();
    const session: HarnessSession = await harness.start(ctx, {
      prompt: "__fake_async_questions__",
      sessionId: "host-1",
      events: sink,
    });
    expect(typeof session.replyQuestion).toBe("function");
    await session.replyQuestion!({ callId: "first-question", answers: [["TypeScript"]] });
    await session.replyQuestion!({ callId: "second-question", answers: [[]] });
    expect(await session.done).toEqual({ status: "completed" });
    expect(sink.getMessages().filter((message) => message.role === "user")).toHaveLength(1);
  });
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
    expect(sink.getMessages()).toEqual(messages);
  });

  test("holds a run until its release file appears in the session folder", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "fake-hold-"));
    try {
      const harness = createFakeHarness();
      const held = await harness.start(ctx, {
        prompt: "Keep working __fake_hold__",
        sessionId: "host-1",
        cwd,
        events: recordingSink().sink,
      });
      const normal = await harness.start(ctx, {
        prompt: "Finish",
        sessionId: "host-2",
        cwd,
        events: recordingSink().sink,
      });
      await normal.done;
      expect(await Promise.race([held.done, Promise.resolve("running")])).toBe("running");
      writeFileSync(join(cwd, ".fake-hold-release"), "");
      expect(await held.done).toEqual({ status: "completed" });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
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

    const { patches, sink } = recordingSink(
      await harness.getMessages(ctx, { agentSessionId: started.agentSessionId! }),
    );
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
    expect(sink.getMessages()).toEqual(messages);
  });

  test("streams a long tool-heavy replay and completes when it ends", async () => {
    const harness = createFakeHarness({ turns: 2, chunksPerTurn: 3, chunkDelayMs: 1 });
    const { patches, sink } = recordingSink();

    const session = await harness.start(ctx, {
      prompt: "Replay __fake_long_stream__",
      sessionId: "host-1",
      events: sink,
    });

    expect(await session.done).toEqual({ status: "completed" });
    expect(patches).toHaveLength(7);
    const messages = await harness.getMessages!(ctx, { agentSessionId: session.agentSessionId! });
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "assistant"]);
    expect(messages[2]?.parts.at(-1)).toMatchObject({ type: "tool", tool: "bash", status: "completed" });
  });

  test("holds the first two replay responses until their observer releases them", async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-replay-observer-"));
    const harness = createFakeHarness({ turns: 2, chunksPerTurn: 3, chunkDelayMs: 1 });
    const { patches, sink } = recordingSink();
    const second = Promise.withResolvers<void>();
    const session = await harness.start(ctx, {
      prompt: "Replay __fake_long_stream__ __fake_hold__",
      sessionId: "held-replay",
      cwd: root,
      events: {
        ...sink,
        push: (patch) => {
          sink.push(patch);
          if (patch.op === "add" && patch.path === "/messages/2") second.resolve();
        },
      },
    });
    try {
      await Bun.sleep(20);
      expect(patches).toHaveLength(2);
      writeFileSync(join(root, ".fake-hold-release-1"), "release");
      await second.promise;
      await Bun.sleep(20);
      expect(patches).toHaveLength(5);
      writeFileSync(join(root, ".fake-hold-release-2"), "release");
      expect(await session.done).toEqual({ status: "completed" });
      expect(patches).toHaveLength(7);
      expect(sink.getMessages().at(-1)?.parts.at(-1)).toMatchObject({ type: "tool", tool: "bash" });
    } finally {
      session.stop?.();
      rmSync(root, { recursive: true, force: true });
    }
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
