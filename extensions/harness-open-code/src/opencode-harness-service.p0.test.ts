import { expect, test } from "bun:test";
import type { HarnessContext, HarnessSession } from "@pstdio/sdk/extensions";
import { ctx } from "./harness.test-helpers";
import { createOpencodeHarnessService } from "./opencode-harness-service";

test("project cleanup aborts its native turns before releasing the shared server", async () => {
  const services = createOpencodeHarnessService();
  const first: HarnessContext = { ...ctx, projectId: "first" };
  const second: HarnessContext = { ...ctx, projectId: "second" };
  await services.get(first);
  await services.get(second);
  const stopped: string[] = [];
  const session = (id: string): HarnessSession => ({
    agentSessionId: id,
    done: new Promise(() => {}),
    stop: async () => {
      await Bun.sleep(0);
      stopped.push(id);
    },
  });
  await services.track(first, session("first"));
  await services.track(second, session("second"));
  await services.dispose(first);
  expect(stopped).toEqual(["first"]);
  await services.dispose(second);
  expect(stopped).toEqual(["first", "second"]);
  await expect(services.track(first, session("late"))).rejects.toThrow("disposed");
  expect(stopped).toEqual(["first", "second", "late"]);
});

test("project cleanup stops active work before waiting for a pending read", async () => {
  const services = createOpencodeHarnessService();
  const reply = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const done = Promise.withResolvers<{ status: "cancelled" }>();
  let stopped = false;
  const reading = services.run(ctx, async () => {
    started.resolve();
    await reply.promise;
  });
  await started.promise;
  await services.track(ctx, {
    agentSessionId: "active",
    done: done.promise,
    stop: async () => {
      stopped = true;
      done.resolve({ status: "cancelled" });
    },
  });
  const disposing = services.dispose(ctx);
  try {
    await Bun.sleep(0);
    expect(stopped).toBe(true);
  } finally {
    reply.resolve();
    await reading;
    await disposing;
  }
});
