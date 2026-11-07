import { expect, test } from "bun:test";
import { chatRendererStreamFrames } from "pstdio-api-contracts";
import { createChatSession } from "./chat-session";

test("a fragmented snapshot reserves its field clock before a newer action completes", async () => {
  const session = createChatSession({
    query: async () => ({}),
    action: async () => ({ snapshot: { notice: "New action" } }),
  });
  const frames = [
    ...chatRendererStreamFrames({
      revision: 0,
      snapshot: {
        messages: [{ id: "large", role: "assistant", parts: [{ type: "text", text: "x".repeat(80 * 1024) }] }],
        notice: "Old snapshot",
      },
    }),
  ];
  session.accept(frames[0]);
  await session.run({ type: "openResource", id: "workspace" });
  for (const frame of frames.slice(1)) session.accept(frame);
  expect(session.getSnapshot().conversation.notice).toBe("New action");
});

test("a framed history refresh preserves every visible message until its atomic commit", () => {
  const messages = Array.from({ length: 67 }, (_, index) => ({
    id: `history-${index}`,
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "x".repeat(4096) }],
  }));
  const session = createChatSession({ initial: { messages }, query: async () => ({}), action: async () => undefined });
  const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { messages, notice: "Current" } })];
  let publications = 0;
  session.subscribe(() => {
    publications++;
    expect(session.getSnapshot().messages).toHaveLength(67);
  });
  for (const frame of frames.slice(0, -1)) {
    session.accept(frame);
    expect(session.getSnapshot().messages.at(-1)?.id).toBe("history-66");
    expect(publications).toBe(0);
  }
  session.accept(frames.at(-1));
  expect(publications).toBe(1);
  expect(session.getSnapshot().conversation.notice).toBe("Current");
});

test("one large message patch commits once and subsequent positional patches keep their exact stream base", () => {
  const session = createChatSession({ query: async () => ({}), action: async () => undefined });
  session.accept({ revision: 0, snapshot: { messages: [] } });
  const message = {
    id: "large",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: "🙂".repeat(24_000) }],
  };
  const frames = [
    ...chatRendererStreamFrames({ revision: 1, patch: { op: "add", path: "/messages/0", value: message } }),
  ];
  for (const frame of frames.slice(0, -1)) {
    expect(new TextEncoder().encode(JSON.stringify(frame)).byteLength).toBeLessThanOrEqual(64 * 1024);
    session.accept(frame);
    expect(session.getSnapshot().messages).toEqual([]);
  }
  session.accept(frames.at(-1));
  expect(session.getSnapshot().messages).toEqual([message]);
  session.accept({ revision: 2, patch: { op: "remove", path: "/messages/0" } });
  expect(session.getSnapshot().messages).toEqual([]);
});

test("natural completion rejects an incomplete event without changing the visible transcript", async () => {
  const message = { id: "prior", role: "user" as const, parts: [{ type: "text" as const, text: "Keep" }] };
  const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { notice: "x".repeat(80 * 1024) } })];
  const session = createChatSession({
    initial: { messages: [message] },
    query: async () => ({}),
    action: async () => undefined,
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        yield frames[0];
      },
    }),
  });
  const release = session.retain();
  try {
    await Bun.sleep(0);
    expect(session.getSnapshot().error).toContain("incomplete");
    expect(session.getSnapshot().messages).toEqual([message]);
  } finally {
    release();
  }
});

test("closing during assembly discards its fragments before a new watch starts at revision zero", async () => {
  const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { notice: "x".repeat(80 * 1024) } })];
  const entered = Promise.withResolvers<void>();
  let watches = 0;
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    watch: (signal) => ({
      async *[Symbol.asyncIterator]() {
        if (++watches === 1) {
          yield frames[0];
          entered.resolve();
          await new Promise<void>((done) => signal.addEventListener("abort", () => done(), { once: true }));
          yield frames[1];
        } else yield { revision: 0, snapshot: { notice: "New watch" } };
      },
    }),
  });
  const first = session.retain();
  await entered.promise;
  first();
  const release = session.retain();
  try {
    await Bun.sleep(0);
    expect(session.getSnapshot().conversation.notice).toBe("New watch");
    expect(session.getSnapshot().error).toBeUndefined();
    expect(watches).toBe(2);
  } finally {
    release();
  }
});

test("a transport failure releases incomplete assembly without requiring a later reconnect", async () => {
  const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { notice: "x".repeat(80 * 1024) } })];
  const session = createChatSession({
    query: async () => ({}),
    action: async () => undefined,
    watch: () => ({
      async *[Symbol.asyncIterator]() {
        yield frames[0];
        throw new Error("Transport failed");
      },
    }),
  });
  const release = session.retain();
  try {
    await Bun.sleep(0);
    expect(session.getSnapshot().error).toBe("Transport failed");
    expect(() => session.accept({ revision: 0, snapshot: { notice: "Fresh" } })).not.toThrow();
    expect(session.getSnapshot().conversation.notice).toBe("Fresh");
  } finally {
    release();
    session.dispose();
  }
});

test("an incomplete event owns a later rejected stream result without delaying its visible error", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
        import { chatRendererStreamFrames } from "pstdio-api-contracts";
        import { createChatSession } from ${JSON.stringify(`${import.meta.dir}/chat-session.ts`)};
        const unhandled = [];
        process.on("unhandledRejection", (error) => unhandled.push(String(error)));
        const frames = [...chatRendererStreamFrames({ revision: 0, snapshot: { notice: "x".repeat(80 * 1024) } })];
        const result = Promise.withResolvers();
        const session = createChatSession({
          query: async () => ({}), action: async () => undefined,
          watch: () => ({ result: result.promise, async *[Symbol.asyncIterator]() { yield frames[0]; } }),
        });
        const release = session.retain();
        await Bun.sleep(0);
        const ownerError = session.getSnapshot().error;
        result.reject(new Error("Stream result failed"));
        await Bun.sleep(0);
        console.log(JSON.stringify({ ownerError, unhandled }));
        release();
        session.dispose();
        if (unhandled.length) process.exitCode = 1;
      `,
    ],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(code).toBe(0);
  expect(stderr).toBe("");
  expect(JSON.parse(stdout)).toEqual({ ownerError: "Chat stream ended with an incomplete event.", unhandled: [] });
});
