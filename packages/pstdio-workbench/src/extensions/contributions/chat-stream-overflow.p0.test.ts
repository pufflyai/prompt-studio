import { expect, test } from "bun:test";
import { CommandOutcomeError } from "@pstdio/sdk/extensions";
import { chatRendererStreamFrames } from "pstdio-api-contracts";
import { createChatSession } from "./chat-session";

const overflow = () =>
  new CommandOutcomeError({
    ok: false,
    status: "error",
    code: "command_stream_overflow",
    reason: "command_stream_overflow",
  });
const prior = { id: "prior", role: "assistant" as const, parts: [{ type: "text" as const, text: "Saved reply" }] };

test("an overflowing conversation watch recovers silently without resending work or losing history and draft", async () => {
  let watches = 0;
  let actions = 0;
  const observedErrors: string[] = [];
  const session = createChatSession({
    initial: { messages: [prior] },
    query: async () => ({}),
    action: async () => {
      actions++;
    },
    watch: (signal) => ({
      async *[Symbol.asyncIterator]() {
        if (++watches === 1) {
          yield { revision: 5, snapshot: { notice: "Before overflow" } };
          throw overflow();
        }
        yield { revision: 0, snapshot: { messages: [prior], notice: "Recovered" } };
        await new Promise<void>((done) => signal.addEventListener("abort", () => done(), { once: true }));
      },
    }),
  });
  session.subscribe(() => {
    if (session.getSnapshot().error) observedErrors.push(session.getSnapshot().error!);
  });
  session.changeDraft({ text: "Still typing" });
  const release = session.retain();
  try {
    await Bun.sleep(0);
    expect(session.getSnapshot().error).toBeUndefined();
    expect(session.getSnapshot().messages).toEqual([prior]);
    expect(session.getSnapshot().draft.text).toBe("Still typing");
    await Bun.sleep(1100);
    expect(watches).toBe(2);
    expect(session.getSnapshot().conversation.notice).toBe("Recovered");
    expect(observedErrors).toEqual([]);
    expect(actions).toBe(0);
  } finally {
    release();
    await session.dispose();
  }
});

test.each([
  "none",
  "before",
  "after",
])("a late overflow preserves an action error occurring %s incomplete assembly", async (actionOrder) => {
  const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { notice: "x".repeat(80 * 1024) } })];
  const result = Promise.withResolvers<unknown>();
  const endFirst = Promise.withResolvers<void>();
  let watches = 0;
  const session = createChatSession({
    initial: { messages: [prior] },
    query: async () => ({}),
    action: async () => {
      throw new Error("Action failed");
    },
    watch: (signal) => {
      const first = ++watches === 1;
      return {
        ...(first ? { result: result.promise } : {}),
        async *[Symbol.asyncIterator]() {
          if (first) {
            yield frames[0];
            await endFirst.promise;
          } else {
            yield { revision: 0, snapshot: { messages: [prior], notice: "Recovered" } };
            await new Promise<void>((done) => signal.addEventListener("abort", () => done(), { once: true }));
          }
        },
      };
    },
  });
  const release = session.retain();
  try {
    if (actionOrder === "before")
      await expect(session.run({ type: "openResource", id: "workspace" })).rejects.toThrow("Action failed");
    endFirst.resolve();
    await Bun.sleep(0);
    expect(session.getSnapshot().error).toContain("incomplete");
    if (actionOrder === "after")
      await expect(session.run({ type: "openResource", id: "workspace" })).rejects.toThrow("Action failed");
    result.reject(overflow());
    await Bun.sleep(0);
    expect(session.getSnapshot().error).toBe(actionOrder === "none" ? undefined : "Action failed");
    await Bun.sleep(1100);
    expect(watches).toBe(2);
    expect(session.getSnapshot().conversation.notice).toBe("Recovered");
    expect(session.getSnapshot().error).toBe(actionOrder === "none" ? undefined : "Action failed");
    expect(session.getSnapshot().messages).toEqual([prior]);
  } finally {
    release();
    await session.dispose();
  }
});

test("closing an overflowing watch cancels automatic recovery", async () => {
  let watches = 0;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        watches++;
        yield { revision: 0, snapshot: { messages: [] } };
        throw overflow();
      },
    }),
  });
  const release = session.retain();
  await Bun.sleep(0);
  release();
  await session.dispose();
  await Bun.sleep(1100);
  expect(watches).toBe(1);
  expect(session.getSnapshot().error).toBeUndefined();
});
