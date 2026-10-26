import { expect, test } from "bun:test";
import { createResourceCoordinator } from "./resource-coordinator";

test("shares capacity between execution, preparation and compilation and cancels queued work", async () => {
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 2, memory: 512 }), maxQueued: 3 });
  let finish!: () => void;
  const running = scheduler.run(
    "first",
    { cpu: 2, memory: 192 },
    undefined,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await Bun.sleep(0);
  const controller = new AbortController();
  let started = false;
  const queued = scheduler.run("second", { cpu: 1, memory: 128 }, controller.signal, async () => {
    started = true;
  });
  controller.abort();
  await expect(queued).rejects.toThrow();
  expect(started).toBe(false);
  finish();
  await running;
  await scheduler.run("third", { cpu: 2, memory: 192 }, undefined, async () => {
    started = true;
  });
  expect(started).toBe(true);
});

test("gives another owner a turn before a second queued job from the same owner", async () => {
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const order: string[] = [];
  let finish!: () => void;
  const first = scheduler.run(
    "a",
    { cpu: 1, memory: 128 },
    undefined,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await Bun.sleep(0);
  const jobs = ["a", "a", "b"].map((owner, index) =>
    scheduler.run(owner, { cpu: 1, memory: 128 }, undefined, async () => {
      order.push(`${owner}${index}`);
    }),
  );
  finish();
  await Promise.all([first, ...jobs]);
  expect(order[0]).toBe("b2");
});

test("admits no compiler when memory cannot fit and resumes when headroom returns", async () => {
  let memory = 64;
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 2, memory }) });
  let started = false;
  const work = scheduler.run("build", { cpu: 2, memory: 192 }, undefined, async () => {
    started = true;
  });
  await Bun.sleep(0);
  expect(started).toBe(false);
  expect(scheduler.snapshot().queued).toBe(1);
  memory = 256;
  await scheduler.refresh();
  await work;
  expect(started).toBe(true);
  expect(scheduler.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  scheduler.dispose();
});

test("ends an impossible resource wait with an actionable scoped deadline", async () => {
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 0 }), waitMs: 10 });
  await expect(scheduler.run("build", { cpu: 2, memory: 192 }, undefined, async () => {})).rejects.toMatchObject({
    code: "extension_resource_deadline",
  });
  expect(scheduler.snapshot().queued).toBe(0);
  scheduler.dispose();
});

test("nested commands make progress with one job of capacity", async () => {
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const result = await scheduler.run("parent", { cpu: 1, memory: 128 }, undefined, () =>
    scheduler.run("child", { cpu: 1, memory: 128 }, undefined, async () => "nested result"),
  );
  expect(result).toBe("nested result");
  expect(scheduler.snapshot().running).toEqual({ cpu: 0, memory: 0 });
});

test("bounds queued retained payload cost and releases reservations after failure", async () => {
  const scheduler = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 0 }), maxQueuedBytes: 10 });
  const controller = new AbortController();
  const first = scheduler.run("a", { cpu: 1, memory: 128 }, controller.signal, async () => {}, { bytes: 10 });
  const settled = first.catch((error) => error);
  await expect(
    scheduler.run("b", { cpu: 1, memory: 128 }, undefined, async () => {}, { bytes: 1 }),
  ).rejects.toMatchObject({ code: "extension_queue_full" });
  controller.abort();
  await settled;
  expect(scheduler.snapshot().queuedBytes).toBe(0);
  scheduler.dispose();
});
