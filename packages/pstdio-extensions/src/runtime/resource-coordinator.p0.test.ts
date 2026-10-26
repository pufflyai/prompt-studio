import { expect, test } from "bun:test";
import { createResourceCoordinator } from "./resource-coordinator";
import { withExtensionHostWait } from "./resource-lease";

test("concurrent calls sharing one process do not reserve the same CPU repeatedly", async () => {
  const coordinator = createResourceCoordinator({ capacity: async () => ({ cpu: 2, memory: 512 }) });
  const cpuGroup = {};
  const firstDone = Promise.withResolvers<void>();
  const secondDone = Promise.withResolvers<void>();
  const waiting = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const resumed = Promise.withResolvers<void>();
  const first = coordinator.run(
    "shared",
    { cpu: 1, memory: 64 },
    undefined,
    async () => {
      await withExtensionHostWait(async () => {
        waiting.resolve();
        await resume.promise;
      });
      resumed.resolve();
      await firstDone.promise;
    },
    { cpuGroup },
  );
  await waiting.promise;
  const second = coordinator.run("shared", { cpu: 1, memory: 64 }, undefined, () => secondDone.promise, { cpuGroup });
  try {
    await Bun.sleep(0);
    resume.resolve();
    await resumed.promise;
    expect(coordinator.snapshot().running).toEqual({ cpu: 1, memory: 128 });
    await expect(coordinator.run("other", { cpu: 1, memory: 64 }, undefined, async () => "responsive")).resolves.toBe(
      "responsive",
    );
    firstDone.resolve();
    await first;
    expect(coordinator.snapshot().running.cpu).toBe(1);
    secondDone.resolve();
    await second;
    expect(coordinator.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  } finally {
    resume.resolve();
    firstDone.resolve();
    secondDone.resolve();
    await Promise.all([first, second]);
    coordinator.dispose();
  }
});

test("accepted work resumes after host I/O when resource headroom falls", async () => {
  let memory = 256;
  const coordinator = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory }) });
  const waiting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const work = coordinator.run("mutation", { cpu: 1, memory: 128 }, undefined, async () => {
    await withExtensionHostWait(async () => {
      waiting.resolve();
      await release.promise;
    });
    return "accepted work completed";
  });
  await waiting.promise;
  memory = 0;
  await coordinator.refresh();
  release.resolve();
  await expect(work).resolves.toBe("accepted work completed");
  expect(coordinator.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  coordinator.dispose();
});

test("host I/O releases CPU capacity while retaining memory and resumes before execution", async () => {
  const coordinator = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const waiting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const parent = coordinator.run("parent", { cpu: 1, memory: 128 }, undefined, async () => {
    await withExtensionHostWait(async () => {
      waiting.resolve();
      await release.promise;
    });
    expect(coordinator.snapshot().running.cpu).toBe(1);
    return "parent";
  });
  await waiting.promise;
  expect(coordinator.snapshot().running).toEqual({ cpu: 0, memory: 128 });
  await expect(coordinator.run("other", { cpu: 1, memory: 128 }, undefined, async () => "other")).resolves.toBe(
    "other",
  );
  release.resolve();
  await expect(parent).resolves.toBe("parent");
  expect(coordinator.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  coordinator.dispose();
});

test("a nested command obtains the released parent capacity during a host call", async () => {
  const coordinator = createResourceCoordinator({ capacity: async () => ({ cpu: 1, memory: 256 }) });
  const result = await coordinator.run("parent", { cpu: 1, memory: 64 }, undefined, async () =>
    withExtensionHostWait(() => coordinator.run("child", { cpu: 1, memory: 64 }, undefined, async () => "child")),
  );
  expect(result).toBe("child");
  expect(coordinator.snapshot().running).toEqual({ cpu: 0, memory: 0 });
  coordinator.dispose();
});

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
