import { expect, test } from "bun:test";
import { createSessionScheduler } from "./session-scheduler";
import { withSchedulingLock } from "./session-scheduler-internals";

test("a slow history read never holds the global session scheduling lock", async () => {
  const ready = Promise.withResolvers<never>();
  const entry = { conversationReady: ready.promise };
  const session = { id: "s", agent: "agent", agent_session_id: "thread", status: "completed" };
  const scheduler = createSessionScheduler({
    sessionService: { get: async () => session, store: { get: () => entry } },
  } as never);
  const starting = scheduler.startOrQueueExisting({ session: session as never, prompt: "next" }).catch(() => undefined);
  await Bun.sleep(0);
  try {
    expect(await Promise.race([withSchedulingLock(async () => "available"), Bun.sleep(30).then(() => "blocked")])).toBe(
      "available",
    );
  } finally {
    ready.reject(new Error("history unavailable"));
    await starting;
  }
});
