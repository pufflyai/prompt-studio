import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { withFileMutationLock } from "pstdio-paths";
import {
  createPreparationClient,
  createPreparationScope,
  withBackgroundPreparation,
  withRequestedPreparation,
} from "./preparation-client";
import { preparationBuildConcurrency } from "./preparation-command-slots";
import { PREPARATION_YIELD_HOLD_MS } from "./preparation-queue";

const clients: ReturnType<typeof createPreparationClient>[] = [];
const gates: ReturnType<typeof Bun.serve>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  for (const gate of gates.splice(0)) await gate.stop(true);
});
const fixture = (
  options: {
    workers?: 2;
    startupUrl?: (worker: number) => string | undefined;
    onWorkerReady?: (worker: number) => void;
    beforeWorkerTermination?: (worker: number) => Promise<void> | undefined;
  } = {},
) => {
  let workers = 0;
  // A worker can wait on a startup gate, as a slow module load would.
  const client = createPreparationClient(
    () => {
      const index = ++workers;
      const startupUrl = options.startupUrl?.(index);
      const worker = new Worker(
        new URL("./preparation-worker.fixture.ts", import.meta.url),
        startupUrl ? { workerData: { startupUrl } } : {},
      );
      if (options.onWorkerReady)
        worker.on("message", (message) => {
          if (message.kind === "ready") options.onWorkerReady?.(index);
        });
      if (options.beforeWorkerTermination) {
        const terminate = worker.terminate.bind(worker);
        worker.terminate = async () => {
          await options.beforeWorkerTermination?.(index);
          return terminate();
        };
      }
      return worker;
    },
    undefined,
    { workers: options.workers },
  );
  clients.push(client);
  return client;
};
const gate = () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  gates.push(server);
  return { entered, release, url: server.url.href };
};
// When an interrupted job starts again after its preemptor retired it.
const restartOf = (client: ReturnType<typeof createPreparationClient>, name: string) => {
  let entries = 0;
  const restarted = Promise.withResolvers<number>();
  const unsubscribe = client.subscribe((event) => {
    if (event.entered === name && ++entries === 2) restarted.resolve(performance.now());
  });
  return { restarted: restarted.promise, unsubscribe };
};
// Within the window the preemptor keeps a job running on its second worker, so the hold cannot lapse.
// Only a loan or a direct wait can restart the interrupted job; without one it must stay held.
const restartWhileBusy = (restarted: Promise<number>) =>
  Promise.race([restarted.then(() => "restarted"), Bun.sleep(PREPARATION_YIELD_HOLD_MS * 2).then(() => "held")]);

test.each([
  "idle",
  "active",
] as const)("host configuration replaces an %s core worker without losing requests", async (phase) => {
  const client = fixture();
  const blocked = gate();
  const first = client.run<{ sequence: number }>("wait", { name: "core", url: blocked.url });
  await blocked.entered.promise;
  if (phase === "idle") {
    blocked.release.resolve();
    expect((await first).sequence).toBe(1);
  }
  const next = phase === "active" ? client.run<{ sequence: number }>("value", { name: "queued" }) : undefined;
  client.configureWorker(() => new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url)));
  blocked.release.resolve();
  expect((await first).sequence).toBe(1);
  expect((await (next ?? client.run<{ sequence: number }>("value", { name: "host" }))).sequence).toBe(1);
});

test("a busy preparation worker leaves the host event loop responsive", async () => {
  const client = fixture();
  const entered = Promise.withResolvers<void>();
  client.subscribe(() => entered.resolve());
  let finished = false;
  const work = client.run("busy", {}).then(() => {
    finished = true;
  });
  await entered.promise;
  await Bun.sleep(0);
  expect(finished).toBe(false);
  await work;
});

test("requested tools overtake queued background inspections", async () => {
  const client = fixture();
  const blocked = gate();
  const first = client.run("wait", { name: "first", url: blocked.url });
  await blocked.entered.promise;
  const background = client.run<{ sequence: number }>("value", { name: "background" }, { priority: "background" });
  const requested = client.run<{ sequence: number }>("value", { name: "requested" });
  blocked.release.resolve();
  await first;
  expect((await requested).sequence).toBe(2);
  expect((await background).sequence).toBe(3);
});

test.each([
  "continues",
  "cancels",
] as const)("restoration stays held in its second preemptor's gap until the edit %s", async (mode) => {
  const client = fixture();
  const restoration = gate();
  const build = gate();
  const restart = restartOf(client, "shared-build-restoration");
  const startedFirst = Promise.withResolvers<void>();
  const startedSecond = Promise.withResolvers<void>();
  const shared = Promise.withResolvers<{ sequence: number }>();
  void shared.promise.catch(() => undefined);
  const gap = Promise.withResolvers<void>();
  const cancellation = new AbortController();
  const cancelled = new Error("Cancel the second edit in its callback gap");
  const dependency = withBackgroundPreparation(createPreparationScope);
  let workerLosses = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") workerLosses++;
  });
  const restore = client.withContinuation(
    () => client.run("wait", { name: "shared-build-restoration", url: restoration.url }, { resources: ["/shared"] }),
    { priority: "restoration" },
  );
  void restore.catch(() => undefined);
  const edit = (started: typeof startedFirst, afterBuild: () => Promise<unknown> | undefined) =>
    client.withContinuation(async () => {
      const caller = createPreparationScope();
      const release = dependency.request(caller);
      started.resolve();
      try {
        await shared.promise;
        return await afterBuild();
      } finally {
        release();
        caller.dispose();
      }
    });
  let first: ReturnType<typeof edit> | undefined;
  let second: Promise<unknown> | undefined;
  try {
    await restoration.entered.promise;
    first = edit(startedFirst, () => undefined);
    void first.catch(() => undefined);
    await startedFirst.promise;
    second = edit(startedSecond, async () => {
      await gap.promise;
      cancellation.signal.throwIfAborted();
      return client.run<{ sequence: number }>("value", { name: "second-edit-step" }, { resources: ["/shared"] });
    }).catch((error: unknown) => error);
    await startedSecond.promise;
    expect(dependency.continuations).toHaveLength(2);
    shared.resolve(
      dependency.run(() =>
        client.run<{ sequence: number }>(
          "wait",
          { name: "shared-edit-build", url: build.url },
          {
            resources: ["/shared"],
          },
        ),
      ),
    );
    await build.entered.promise;
    build.release.resolve();
    expect((await shared.promise).sequence).toBe(1);
    await first;

    const next = await Promise.race([restart.restarted.then(() => "resumed"), Bun.sleep(75).then(() => "held")]);
    expect(next).toBe("held");
    if (mode === "cancels") cancellation.abort(cancelled);
    gap.resolve();
    if (mode === "cancels") expect(await second).toBe(cancelled);
    else expect(await second).toMatchObject({ sequence: 2 });
    await restart.restarted;
    expect(workerLosses).toBe(1);
    restoration.release.resolve();
    expect(await restore).toMatchObject({ sequence: mode === "cancels" ? 2 : 3 });
  } finally {
    shared.reject(cancelled);
    gap.resolve();
    build.release.resolve();
    restoration.release.resolve();
    await client.stop();
    await Promise.allSettled([restore, first, second]);
    restart.unsubscribe();
    unsubscribe();
    dependency.dispose();
  }
});

test.each([
  "background check",
  "background step of an edit",
] as const)("restoration resumes while a %s sharing the preempting build still has work", async (mode) => {
  const client = fixture({ workers: 2 });
  const primary = gate();
  const background = gate();
  const watcher = gate();
  const restart = restartOf(client, "watcher-restoration");
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const build = Promise.withResolvers<unknown>();
  void build.promise.catch(() => undefined);
  let dependency: ReturnType<typeof createPreparationScope> | undefined;
  try {
    // Occupy the primary so the background check retains only the overflow worker.
    const primer = track(client.run("wait", { name: "primary", url: primary.url }, { resources: ["/source"] }));
    await primary.entered.promise;
    const check = track(
      client.withContinuation(
        () =>
          withBackgroundPreparation(async () => {
            dependency = createPreparationScope();
            try {
              await Promise.all([
                client.run("wait", { name: "background-check", url: background.url }, { resources: ["/other"] }),
                build.promise,
              ]);
            } finally {
              dependency.dispose();
            }
          }),
        { priority: mode === "background check" ? "background" : "requested" },
      ),
    );
    await background.entered.promise;
    primary.release.resolve();
    await primer;
    const restore = track(
      client.withContinuation(
        () => client.run("wait", { name: "watcher-restoration", url: watcher.url }, { resources: ["/source"] }),
        { priority: "restoration" },
      ),
    );
    await watcher.entered.promise;
    const edit = track(
      client.withContinuation(async () => {
        const caller = createPreparationScope();
        const shared = dependency!;
        const release = shared.request(caller);
        try {
          build.resolve(shared.run(() => client.run("value", { name: "shared-build" }, { resources: ["/source"] })));
          return await build.promise;
        } finally {
          release();
          caller.dispose();
        }
      }),
    );
    // Sequence one proves the edit retired the primary that was restoring the watch.
    expect(await edit).toMatchObject({ sequence: 1 });
    expect(await restartWhileBusy(restart.restarted)).toBe("restarted");
    watcher.release.resolve();
    expect(await restore).toMatchObject({ sequence: 2 });
    background.release.resolve();
    await check;
  } finally {
    restart.unsubscribe();
    build.reject(new Error("Preparation fixture stopped"));
    for (const pending of [primary, background, watcher]) pending.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("restoration reserves its asynchronous admission gap before background work resumes", async () => {
  const client = fixture();
  const active = gate();
  const backgroundGate = gate();
  const releaseLookup = Promise.withResolvers<void>();
  const first = client.run("wait", { name: "first", url: active.url });
  await active.entered.promise;
  const background = client.run<{ sequence: number }>(
    "wait",
    { name: "background", url: backgroundGate.url },
    { priority: "background" },
  );
  const restoration = client.withContinuation(async () => {
    await releaseLookup.promise;
    return client.run<{ sequence: number }>("value", { name: "restore" }, { priority: "background" });
  });
  try {
    active.release.resolve();
    await first;
    expect(
      await Promise.race([backgroundGate.entered.promise.then(() => "started"), Bun.sleep(50).then(() => "held")]),
    ).toBe("held");
    releaseLookup.resolve();
    expect((await restoration).sequence).toBe(2);
    backgroundGate.release.resolve();
    expect((await background).sequence).toBe(3);
  } finally {
    active.release.resolve();
    releaseLookup.resolve();
    backgroundGate.release.resolve();
    await Promise.allSettled([first, restoration, background]);
  }
});

test("a requested tool can prepare while background evaluation is suspended", async () => {
  const client = fixture();
  const blocked = gate();
  const background = client.run("wait", { name: "background", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  try {
    const requested = await client.run("value", { name: "requested" });
    expect(requested).toMatchObject({ name: "requested" });
  } finally {
    blocked.release.resolve();
    await background;
  }
});

test("coalesced callers cancel independently and execute once", async () => {
  const client = fixture();
  const blocked = gate();
  const controller = new AbortController();
  const first = client.run("wait", { name: "shared", url: blocked.url }, { signal: controller.signal });
  const outcome = first.catch((error) => error);
  const second = client.run<{ sequence: number }>("wait", { name: "shared", url: blocked.url });
  await blocked.entered.promise;
  controller.abort(new Error("one caller cancelled"));
  expect(((await outcome) as Error).message).toBe("one caller cancelled");
  blocked.release.resolve();
  expect((await second).sequence).toBe(1);
});

test("worker exit settles active and queued callers, and a new request can recover", async () => {
  const client = fixture();
  const failed = client.run("exit", {}).catch((error) => error);
  const queued = client.run("value", { name: "queued" }).catch((error) => error);
  expect(((await failed) as Error).message).toContain("exited");
  expect(((await queued) as Error).message).toContain("exited");
  expect(await client.run("value", { name: "recovered" })).toMatchObject({ name: "recovered" });
});

test("shutdown settles pending work even when extension evaluation never resolves", async () => {
  const client = fixture();
  const entered = Promise.withResolvers<void>();
  client.subscribe(() => entered.resolve());
  const work = client.run("hang", {}).catch((error) => error);
  await entered.promise;
  await client.stop();
  expect(((await work) as Error).message).toContain("stopped");
});

test("preparation failures settle their caller and release the queue", async () => {
  const client = fixture();
  await expect(client.run("reject", {})).rejects.toThrow("preparation failed");
  expect(await client.run("value", { name: "next" })).toMatchObject({ name: "next" });
});

test.each([
  "active",
  "retiring",
] as const)("a cancelled %s evaluation settles after its worker exits", async (phase) => {
  let ownerExited = false;
  let ownerStarted = false;
  const client = createPreparationClient(() => {
    const worker = new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url));
    if (!ownerStarted) {
      ownerStarted = true;
      worker.once("exit", () => {
        ownerExited = true;
      });
    }
    return worker;
  });
  clients.push(client);
  const entered = Promise.withResolvers<void>();
  const controller = new AbortController();
  const reason = new Error("Evaluation owner closed.");
  client.subscribe((event) => {
    if (event.entered === "hang") entered.resolve();
    if (phase === "retiring" && event.kind === "worker-lost") controller.abort(reason);
  });
  const work = client.run("hang", {}, { priority: "background", signal: controller.signal }).catch((error) => error);
  await entered.promise;
  if (phase === "active") controller.abort(reason);
  const next = client.run("value", { name: "next tool" }).catch((error) => error);
  expect(await work).toBe(reason);
  expect(ownerExited).toBe(true);
  expect(await next).toMatchObject({ name: "next tool" });
});

test("cancelling uninterruptible evaluation lets the next requested tool prepare", async () => {
  const client = fixture();
  const entered = Promise.withResolvers<void>();
  client.subscribe((event) => {
    if (event.entered === "hang") entered.resolve();
  });
  const controller = new AbortController();
  const work = client.run("hang", {}, { signal: controller.signal }).catch((error: Error) => error);
  await entered.promise;
  controller.abort(new Error("cancelled evaluation"));
  const next = client.run("value", { name: "next tool" });
  expect(((await work) as Error).message).toBe("cancelled evaluation");
  expect(await next).toMatchObject({ name: "next tool" });
});

for (const task of ["spin", "lock-spin", "child-spin", "stdin-child-spin"])
  test(`cancelling ${task} retires the worker and its owned resources`, async () => {
    const root = mkdtempSync(join(tmpdir(), "preparation-retirement-"));
    const path = join(root, "resource");
    const client = fixture();
    const entered = Promise.withResolvers<void>();
    client.subscribe((event) => {
      if (event.entered === task) entered.resolve();
    });
    const controller = new AbortController();
    const work = client.run(task, { path }, { signal: controller.signal }).catch((error: Error) => error);
    try {
      await entered.promise;
      let pid: number | undefined;
      if (task === "child-spin" || task === "stdin-child-spin") {
        while (!pid) {
          try {
            pid = Number(readFileSync(path, "utf8"));
          } catch {
            await Bun.sleep(1);
          }
        }
      }
      controller.abort(new Error("cancelled synchronous evaluation"));
      expect(await work).toBeInstanceOf(Error);
      expect(await client.run("value", { name: "next" })).toMatchObject({ name: "next" });
      if (task === "lock-spin") expect(withFileMutationLock(path, () => "recovered")).toBe("recovered");
      if (pid) {
        let alive = true;
        try {
          process.kill(pid, 0);
        } catch {
          alive = false;
        }
        expect(alive).toBe(false);
      }
    } finally {
      await client.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

test("a prepared adoption finishes before later inspection even inside startup background work", async () => {
  const client = fixture();
  const blocked = gate();
  const adoption = withBackgroundPreparation(() =>
    withRequestedPreparation(() => client.run<{ sequence: number }>("wait", { name: "adoption", url: blocked.url })),
  );
  await blocked.entered.promise;
  const inspected = client.run<{ sequence: number }>("value", { name: "inspect" });
  blocked.release.resolve();
  expect((await adoption).sequence).toBe(1);
  expect((await inspected).sequence).toBe(2);
});

test("foreground dependencies promote an already running background preparation", async () => {
  const client = fixture();
  const blocked = gate();
  const scope = withBackgroundPreparation(() => createPreparationScope());
  const dependency = scope.run(() =>
    client.run<{ sequence: number }>("wait", { name: "dependency", url: blocked.url }),
  );
  await blocked.entered.promise;
  scope.request();
  const read = client.run<{ sequence: number }>("value", { name: "read" });
  blocked.release.resolve();
  expect((await dependency).sequence).toBe(1);
  expect((await read).sequence).toBe(2);
});

test("a newly required queued operation overtakes unrelated background evaluation", async () => {
  const client = fixture();
  const blocked = gate();
  const background = client.run("wait", { name: "unrelated", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  const scope = withBackgroundPreparation(() => createPreparationScope());
  const dependency = scope.run(() => client.run<{ name: string }>("value", { name: "dependency" }));
  try {
    scope.request();
    expect((await dependency).name).toBe("dependency");
  } finally {
    blocked.release.resolve();
    await background;
  }
});

test("foreground follow-up work runs before speculative work resumes", async () => {
  const client = fixture();
  const blocked = gate();
  const first = client.run("wait", { name: "first", url: blocked.url });
  await blocked.entered.promise;
  const background = client.run<{ sequence: number }>("value", { name: "background" }, { priority: "background" });
  const followUp = first.then(() => client.run<{ sequence: number }>("value", { name: "follow-up" }));
  blocked.release.resolve();
  expect((await followUp).sequence).toBe(2);
  expect((await background).sequence).toBe(3);
});

test("a requested adoption retains admission between asynchronous host steps", async () => {
  const client = fixture();
  const hostStep = Promise.withResolvers<void>();
  const reachedHost = Promise.withResolvers<void>();
  const blocked = gate();
  const adoption = withRequestedPreparation(async () => {
    await client.run("value", { name: "publish" });
    reachedHost.resolve();
    await hostStep.promise;
    return client.run<{ sequence: number }>("value", { name: "settle" });
  });
  await reachedHost.promise;
  const background = client.run<{ sequence: number }>(
    "wait",
    { name: "scan", url: blocked.url },
    { priority: "background" },
  );
  try {
    await Bun.sleep(20);
    hostStep.resolve();
    expect((await adoption).sequence).toBe(2);
    blocked.release.resolve();
    expect((await background).sequence).toBe(3);
  } finally {
    hostStep.resolve();
    blocked.release.resolve();
    await Promise.allSettled([adoption, background]);
  }
});

test("inherited urgency remains until every foreground owner releases it", () => {
  const scope = withBackgroundPreparation(() => createPreparationScope());
  const first = scope.request();
  const second = scope.request();
  first();
  expect(scope.requested).toBe(true);
  second();
  expect(scope.requested).toBe(false);
  first();
  expect(scope.requested).toBe(false);
});

test("requested host work can await an explicitly background dependency", async () => {
  const client = fixture();
  const result = await withRequestedPreparation(async () => {
    await client.run("value", { name: "start" });
    return client.run<{ sequence: number }>("value", { name: "dependency" }, { priority: "background" });
  });
  expect(result.sequence).toBe(2);
});

test("failed host adoption releases admission to background work", async () => {
  const client = fixture();
  await expect(
    withRequestedPreparation(async () => {
      await client.run("value", { name: "start" });
      throw new Error("host database failed");
    }),
  ).rejects.toThrow("host database failed");
  expect(await client.run("value", { name: "background" }, { priority: "background" })).toMatchObject({
    name: "background",
  });
});

for (const nested of ["scope", "background"] as const) {
  test(`requested adoption can await a nested ${nested} dependency`, async () => {
    const client = fixture();
    const result = await withRequestedPreparation(async () => {
      await client.run("value", { name: "start" });
      const work = () => client.run<{ sequence: number }>("value", { name: "nested" }, { priority: "background" });
      if (nested === "background") return withBackgroundPreparation(work);
      const child = createPreparationScope();
      try {
        return await child.run(work);
      } finally {
        child.dispose();
      }
    });
    expect(result.sequence).toBe(2);
  });
}

test("cancelling a coalesced foreground reader releases its background job's urgency", async () => {
  const client = fixture();
  const blocked = gate();
  const input = { name: "shared", url: blocked.url };
  const background = client.run("wait", input, { priority: "background" });
  await blocked.entered.promise;
  const controller = new AbortController();
  const foreground = client.run("wait", input, { signal: controller.signal }).catch((error: unknown) => error);
  try {
    controller.abort();
    expect(await foreground).toBe(controller.signal.reason);
    expect(await client.run("value", { name: "next" })).toMatchObject({ name: "next" });
  } finally {
    blocked.release.resolve();
    await background;
  }
});

for (const promotedAtStart of [false, true]) {
  test(`nested preparation tracks parent urgency ${promotedAtStart ? "released" : "acquired"} after creation`, async () => {
    const client = fixture();
    const blocked = gate();
    const parent = withBackgroundPreparation(() => createPreparationScope());
    let release = promotedAtStart ? parent.request() : () => {};
    const child = parent.run(() => createPreparationScope());
    const dependency = child.run(() => client.run<{ sequence: number }>("wait", { name: "nested", url: blocked.url }));
    try {
      await blocked.entered.promise;
      if (promotedAtStart) {
        release();
        expect(await client.run("value", { name: "next" })).toMatchObject({ name: "next" });
      } else {
        release = parent.request();
        const read = client.run<{ sequence: number }>("value", { name: "read" });
        blocked.release.resolve();
        expect((await dependency).sequence).toBe(1);
        expect((await read).sequence).toBe(2);
      }
    } finally {
      release();
      blocked.release.resolve();
      await dependency;
    }
  });
}

test("an idle shared preparation worker lets a CLI process exit", async () => {
  const entry = new URL("./preparation-client.ts", import.meta.url).href;
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `import { runExtensionPreparation } from ${JSON.stringify(entry)};
     await runExtensionPreparation("source.discover", { root: "/missing-preparation-cli-fixture" });
     console.log(JSON.stringify({ finished: true }));`,
    ],
    { stdout: "pipe", stderr: "pipe", timeout: 3000 },
  );
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect(code, stderr).toBe(0);
  expect(JSON.parse(stdout)).toEqual({ finished: true });
});

test("status inspection yields through an admitted continuation's worker and host steps", async () => {
  const client = fixture();
  const blocked = gate();
  const host = Promise.withResolvers<void>();
  const atHost = Promise.withResolvers<void>();
  const continued = client.withContinuation(() =>
    withBackgroundPreparation(async () => {
      await client.run("wait", { name: "frontend", url: blocked.url });
      atHost.resolve();
      await host.promise;
      return client.run("value", { name: "publication" });
    }),
  );
  await blocked.entered.promise;
  const inspected = client.run("value", { name: "inventory" }, { preserveActiveContinuation: true });
  try {
    expect(await Promise.race([inspected.then(() => "interrupted"), Bun.sleep(50).then(() => "held")])).toBe("held");
    blocked.release.resolve();
    await atHost.promise;
    expect(await Promise.race([inspected.then(() => "interrupted"), Bun.sleep(50).then(() => "held")])).toBe("held");
    host.resolve();
    expect(await continued).toMatchObject({ name: "publication", sequence: 2 });
    expect(await inspected).toMatchObject({ name: "inventory", sequence: 3 });
  } finally {
    blocked.release.resolve();
    host.resolve();
    await Promise.allSettled([continued, inspected]);
  }
});

test("status inspection can interrupt an unreserved speculative evaluation", async () => {
  const client = fixture();
  const blocked = gate();
  const background = client.run("wait", { name: "candidate", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  try {
    expect(await client.run("value", { name: "inventory" }, { preserveActiveContinuation: true })).toMatchObject({
      name: "inventory",
    });
  } finally {
    blocked.release.resolve();
    await background;
  }
});

test("a live background continuation can overtake an unreserved speculative evaluation", async () => {
  const client = fixture();
  const blocked = gate();
  const background = client.run("wait", { name: "candidate", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  const edit = client.withContinuation(() => withBackgroundPreparation(() => client.run("value", { name: "edit" })));
  try {
    expect(await Promise.race([edit.then(() => "ready"), Bun.sleep(1000).then(() => "blocked")])).toBe("ready");
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([background, edit]);
  }
});

test.each([
  "speculative",
  "live",
] as const)("a coalesced status read cannot promote ineligible %s work", async (kind) => {
  const client = fixture();
  const blocked = gate();
  const input = { name: "shared", url: blocked.url };
  const start = () => client.run("wait", input, { priority: "background" });
  const background = kind === "live" ? client.withContinuation(() => withBackgroundPreparation(start)) : start();
  await blocked.entered.promise;
  const joined = client.run("wait", input, { preserveActiveContinuation: true });
  const next =
    kind === "live"
      ? client.run("value", { name: "next" })
      : client.withContinuation(() => withBackgroundPreparation(() => client.run("value", { name: "next" })));
  try {
    expect(await Promise.race([next.then(() => "ready"), Bun.sleep(1000).then(() => "blocked")])).toBe("ready");
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([background, joined, next]);
  }
});

test("background watcher restoration reserves admission without retiring an active background job", async () => {
  const client = fixture();
  const blocked = gate();
  const background = client.run("wait", { name: "attachment", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  const restoration = client.withContinuation(
    () => client.run("value", { name: "restore" }, { priority: "background" }),
    { priority: "background" },
  );
  try {
    expect(await Promise.race([restoration.then(() => "retired"), Bun.sleep(50).then(() => "preserved")])).toBe(
      "preserved",
    );
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([background, restoration]);
  }
});

test("restoration completes its host lookup before resuming another owned background continuation", async () => {
  const client = fixture();
  const blocked = gate();
  const lookup = Promise.withResolvers<void>();
  const resumed = Promise.withResolvers<void>();
  let restoration: Promise<unknown> | undefined;
  const background = client.withContinuation(
    () => withBackgroundPreparation(() => client.run("wait", { name: "owned-background", url: blocked.url })),
    { priority: "background" },
  );
  await blocked.entered.promise;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-ready" && !restoration) {
      restoration = client.withContinuation(
        async () => {
          await lookup.promise;
          return client.run("value", { name: "restore" }, { priority: "background" });
        },
        { priority: "restoration" },
      );
    }
    if (event.entered === "owned-background") resumed.resolve();
  });
  const requested = client.run("value", { name: "requested" });
  try {
    expect(await requested).toMatchObject({ name: "requested", sequence: 1 });
    expect(await Promise.race([resumed.promise.then(() => "resumed"), Bun.sleep(50).then(() => "held")])).toBe("held");
    lookup.resolve();
    expect(await restoration).toMatchObject({ name: "restore", sequence: 2 });
  } finally {
    lookup.resolve();
    blocked.release.resolve();
    unsubscribe();
    await Promise.allSettled([background, requested, restoration]);
  }
});

test.each([
  "retained",
  "released",
  "finished",
] as const)("a background predecessor borrows caller urgency with %s ownership", async (phase) => {
  const client = fixture();
  const blocked = gate();
  const unrelated = client.run("wait", { name: "unrelated", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  const queued = Promise.withResolvers<void>();
  let owner: ReturnType<typeof createPreparationScope> | undefined;
  const dependency = client.withContinuation(
    () =>
      withBackgroundPreparation(async () => {
        owner = createPreparationScope();
        await queued.promise;
        return owner.run(() => client.run("value", { name: "dependency" })).finally(() => owner!.dispose());
      }),
    { priority: "background" },
  );
  let releaseLoan: (() => void) | undefined;
  try {
    await client.withContinuation(() =>
      withBackgroundPreparation(async () => {
        const caller = createPreparationScope();
        const first = owner!.request(caller);
        releaseLoan = owner!.request(caller);
        first();
        expect(caller.requested).toBe(false);
        expect(owner!.requested).toBe(false);
        if (phase === "released") releaseLoan();
        if (phase === "finished") {
          caller.dispose();
          return;
        }
        queued.resolve();
        try {
          if (phase === "retained") {
            // The unrelated worker gate remains closed; completion proves the loan
            // admits its dependency without asserting scheduler wall-clock speed.
            expect(await dependency).toMatchObject({ name: "dependency" });
          } else {
            expect(await Promise.race([dependency.then(() => "ready"), Bun.sleep(100).then(() => "blocked")])).toBe(
              "blocked",
            );
          }
          blocked.release.resolve();
          await dependency;
        } finally {
          releaseLoan();
          caller.dispose();
        }
      }),
    );
    if (phase === "finished") {
      queued.resolve();
      expect(await Promise.race([dependency.then(() => "ready"), Bun.sleep(100).then(() => "blocked")])).toBe(
        "blocked",
      );
    }
  } finally {
    queued.resolve();
    blocked.release.resolve();
    releaseLoan?.();
    await Promise.allSettled([unrelated, dependency]);
  }
});

test("a continuation does not retire an already admitted status read when its queued admission closes", async () => {
  const client = fixture();
  const blocked = gate();
  const inspection = client.run("wait", { name: "inventory", url: blocked.url }, { preserveActiveContinuation: true });
  await blocked.entered.promise;
  const restoration = client.withContinuation(
    () => withBackgroundPreparation(() => client.run("value", { name: "restore" })),
    { priority: "background" },
  );
  try {
    expect(await Promise.race([restoration.then(() => "retired"), Bun.sleep(50).then(() => "preserved")])).toBe(
      "preserved",
    );
    blocked.release.resolve();
    expect(await inspection).toMatchObject({ name: "inventory", sequence: 1 });
    expect(await restoration).toMatchObject({ name: "restore", sequence: 2 });
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([inspection, restoration]);
  }
});

test("fresh inventory stays responsive during unchanged attachment reconciliation", async () => {
  const client = fixture();
  const blocked = gate();
  const attachment = client.withContinuation(
    () => withBackgroundPreparation(() => client.run("wait", { name: "attachment", url: blocked.url })),
    { priority: "background" },
  );
  await blocked.entered.promise;
  const inventory = client.run("value", { name: "inventory" }, { preserveActiveContinuation: true });
  try {
    expect(await Promise.race([inventory.then(() => "ready"), Bun.sleep(1000).then(() => "blocked")])).toBe("ready");
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([attachment, inventory]);
  }
});

test("saturation rejects new work transiently and preserves every admitted background check", async () => {
  const client = fixture();
  const blocked = gate();
  const first = client.run("wait", { name: "active", url: blocked.url });
  await blocked.entered.promise;
  const background = Array.from({ length: 128 }, (_, index) =>
    client.run("value", { name: `background-${index}` }, { priority: "background" }),
  );
  try {
    await expect(client.run("value", { name: "overflow" })).rejects.toMatchObject({
      code: "extension_preparation_unavailable",
    });
    blocked.release.resolve();
    await first;
    expect(await Promise.all(background)).toHaveLength(128);
    expect(await client.run("value", { name: "requested" })).toMatchObject({ name: "requested" });
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([first, ...background]);
  }
});

test("preemption at capacity preserves the interrupted check and every queued owner", async () => {
  const client = fixture();
  const blocked = gate();
  const first = client.run("wait", { name: "interrupted", url: blocked.url }, { priority: "background" });
  await blocked.entered.promise;
  const background = Array.from({ length: 127 }, (_, index) =>
    client.run("value", { name: `background-${index}` }, { priority: "background" }),
  );
  const requested = client.run("value", { name: "requested" });
  try {
    await expect(client.run("value", { name: "overflow" })).rejects.toMatchObject({
      code: "extension_preparation_unavailable",
    });
    expect(await requested).toMatchObject({ name: "requested", sequence: 1 });
    blocked.release.resolve();
    expect(await first).toMatchObject({ name: "interrupted" });
    expect(await Promise.all(background)).toHaveLength(127);
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([first, requested, ...background]);
  }
});

test("cancelling an interrupted owner keeps its idle replacement worker", async () => {
  const client = fixture();
  const blocked = gate();
  const controller = new AbortController();
  let workers = 0;
  client.subscribe((event) => {
    if (event.kind === "worker-ready" && ++workers === 2) controller.abort(new Error("Inspection closed."));
  });
  const first = client
    .run("wait", { name: "interrupted", url: blocked.url }, { priority: "background", signal: controller.signal })
    .catch((error) => error);
  await blocked.entered.promise;
  try {
    expect(await client.run("value", { name: "requested" })).toMatchObject({ name: "requested", sequence: 1 });
    expect(await first).toMatchObject({ message: "Inspection closed." });
    expect(workers).toBe(2);
  } finally {
    blocked.release.resolve();
    await first;
  }
});

test.each([
  "ready-replacement",
  // The replacement worker starts slower than the hold. The edit reserved on it still owns the slot.
  "slow-replacement",
] as const)("an edit's host gaps do not readmit the attachment check it interrupted (%s)", async (mode) => {
  const startup = gate();
  const client = fixture(
    mode === "slow-replacement" ? { startupUrl: (worker) => (worker > 1 ? startup.url : undefined) } : {},
  );
  if (mode === "slow-replacement")
    void startup.entered.promise.then(async () => {
      await Bun.sleep(PREPARATION_YIELD_HOLD_MS + 200);
      startup.release.resolve();
    });
  else startup.release.resolve();
  const blocked = gate();
  const attach = () =>
    client.withContinuation(
      () => withBackgroundPreparation(() => client.run("wait", { name: "attachment", url: blocked.url })),
      { priority: "background" },
    );
  const work: Promise<unknown>[] = [attach()];
  let lost = 0;
  // Like the source watcher, every lost worker restores its watch and reconciles attachments.
  const unsubscribe = client.subscribe((event) => {
    if (event.kind !== "worker-lost") return;
    lost++;
    const restored = client.withContinuation(
      () => client.run("value", { name: "restore" }, { priority: "background" }),
      { priority: "restoration" },
    );
    work.push(restored, restored.then(attach));
  });
  await blocked.entered.promise;
  const edit = client.withContinuation(() =>
    withBackgroundPreparation(async () => {
      for (let step = 0; step < 5; step++) {
        await client.run("value", { name: `edit-${step}` });
        // A database round trip between the edit's preparation steps.
        await Bun.sleep(1);
      }
    }),
  );
  try {
    await edit;
    expect(lost).toBe(1);
    blocked.release.resolve();
    await Promise.all(work);
  } finally {
    unsubscribe();
    startup.release.resolve();
    blocked.release.resolve();
    await Promise.allSettled([edit, ...work]);
  }
});

test.each([
  "same-job",
  "lent-to-restoration",
  "foreground-loan",
  "released-foreground-loan",
  // Without a loan the hold cannot see the dependency. It only delays the job until the hold lapses.
  "unlent-await",
] as const)("a continuation that waits on the job it interrupted lets it run (%s)", async (mode) => {
  const client = fixture({ workers: 2 });
  const blocked = gate();
  const predecessorStarted = Promise.withResolvers<void>();
  const busy = gate();
  const competingStep = mode === "released-foreground-loan" ? gate() : undefined;
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const input = { name: "predecessor", url: blocked.url };
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
    if (event.entered === input.name) predecessorStarted.resolve();
  });
  const options = { priority: "background", resources: ["/same"] } as const;
  const restart = restartOf(client, input.name);
  let predecessor: ReturnType<typeof createPreparationScope> | undefined;
  // A restoration continuation owns the predecessor, so it ranks before the edit that interrupts it.
  const original = track(
    client.withContinuation(
      () =>
        withBackgroundPreparation(() => {
          const scope = createPreparationScope();
          predecessor = scope;
          return scope.run(() => client.run("wait", input, options)).finally(scope.dispose);
        }),
      { priority: "restoration" },
    ),
  );
  // The HTTP request can arrive before the worker event. Count the first entry before retiring it.
  await Promise.all([blocked.entered.promise, predecessorStarted.promise]);
  const edit = track(
    client.withContinuation(async () => {
      await client.run("value", { name: "urgent-step" }, { resources: ["/same"] });
      expect(lost).toBe(1);
      // A disjoint step keeps the edit busy on the second worker while it waits for the predecessor.
      const running = track(client.run("wait", { name: "busy-step", url: busy.url }, { resources: ["/busy"] }));
      await busy.entered.promise;
      if (mode === "same-job") await client.run("wait", input, options);
      else if (mode === "unlent-await") await original;
      // The edit lends itself to the predecessor it now waits for, through the supported request API.
      else {
        const join = async () => {
          const caller = createPreparationScope();
          // Keep the resource occupied until the foreground loan has been released.
          const competing = competingStep
            ? track(client.run("wait", { name: "competing-step", url: competingStep.url }, { resources: ["/same"] }))
            : undefined;
          await competingStep?.entered.promise;
          const release = predecessor!.request(caller);
          try {
            if (competingStep) {
              release();
              competingStep.release.resolve();
              await competing;
            }
            await original;
          } finally {
            release();
            caller.dispose();
          }
        };
        if (mode === "lent-to-restoration") await withBackgroundPreparation(join);
        else await join();
      }
      await running;
    }),
  );
  try {
    const shouldHold = mode === "unlent-await" || mode === "released-foreground-loan";
    expect(await restartWhileBusy(restart.restarted)).toBe(shouldHold ? "held" : "restarted");
    busy.release.resolve();
    blocked.release.resolve();
    expect(await Promise.race([edit.then(() => "completed"), Bun.sleep(3_000).then(() => "stalled")])).toBe(
      "completed",
    );
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    restart.unsubscribe();
    busy.release.resolve();
    blocked.release.resolve();
    competingStep?.release.resolve();
    // A stalled job never settles on its own; stopping rejects it so the assertion is reported.
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("a long step of the preemptor does not spend the interrupted job's hold", async () => {
  const client = fixture();
  const background = gate();
  const firstStep = gate();
  let lost = 0;
  let backgroundEntries = 0;
  const resumed = Promise.withResolvers<void>();
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
    if (event.entered === "background-check" && ++backgroundEntries === 2) resumed.resolve();
  });
  const check = client.withContinuation(
    () => withBackgroundPreparation(() => client.run("wait", { name: "background-check", url: background.url })),
    { priority: "background" },
  );
  await background.entered.promise;
  const edit = client.withContinuation(() =>
    withBackgroundPreparation(async () => {
      const first = client.run("wait", { name: "edit-step-1", url: firstStep.url });
      await firstStep.entered.promise;
      // The step runs longer than the hold; only the host gap after it may count as idle time.
      await Bun.sleep(1_150);
      firstStep.release.resolve();
      await first;
      const readmitted = await Promise.race([resumed.promise.then(() => true), Bun.sleep(175).then(() => false)]);
      await client.run("value", { name: "edit-step-2" });
      return readmitted;
    }),
  );
  try {
    expect(await edit).toBe(false);
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    firstStep.release.resolve();
    background.release.resolve();
    await Promise.allSettled([edit, check]);
  }
});

test.each([
  // The loan reaches the job through a background scope nested inside the lent scope.
  "nested-loan-with-peer",
  // No loan: only the bounded fallback can release the job while a barred peer waits.
  "unlent-with-peer",
] as const)("a preemptor waiting on its interrupted restoration and a queued peer completes (%s)", async (mode) => {
  const client = fixture({ workers: 2 });
  const blocked = gate();
  const busy = gate();
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  const input = { name: "predecessor", url: blocked.url };
  const restart = restartOf(client, input.name);
  let predecessor: ReturnType<typeof createPreparationScope> | undefined;
  const original = client.withContinuation(
    () =>
      withBackgroundPreparation(() => {
        const scope = createPreparationScope();
        predecessor = scope;
        return scope
          .run(() =>
            withBackgroundPreparation(() =>
              client.run("wait", input, { priority: "background", resources: ["/same"] }),
            ),
          )
          .finally(scope.dispose);
      }),
    { priority: "restoration" },
  );
  await blocked.entered.promise;
  const edit = client.withContinuation(async () => {
    await client.run("value", { name: "urgent-step" }, { resources: ["/same"] });
    expect(lost).toBe(1);
    const running = client.run("wait", { name: "busy-step", url: busy.url }, { resources: ["/busy"] });
    await busy.entered.promise;
    blocked.release.resolve();
    await withBackgroundPreparation(async () => {
      const caller = createPreparationScope();
      const release = mode === "nested-loan-with-peer" ? predecessor!.request(caller) : () => {};
      try {
        // Live restoration bars this background peer, so it must not count as the preemptor's work.
        const peer = client.run(
          "value",
          { name: "edit-background-peer" },
          { priority: "background", resources: ["/same"] },
        );
        await Promise.all([original, peer]);
      } finally {
        release();
        caller.dispose();
      }
    });
    await running;
  });
  try {
    expect(await restartWhileBusy(restart.restarted)).toBe(mode === "unlent-with-peer" ? "held" : "restarted");
    busy.release.resolve();
    expect(await Promise.race([edit.then(() => "completed"), Bun.sleep(3_000).then(() => "stalled")])).toBe(
      "completed",
    );
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    restart.unsubscribe();
    busy.release.resolve();
    blocked.release.resolve();
    await client.stop();
    await Promise.allSettled([edit, original]);
  }
});

test("an unrelated worker's slow startup does not hold the job a preemptor interrupted", async () => {
  const unrelatedStartup = gate();
  const client = fixture({ workers: 2, startupUrl: (worker) => (worker === 2 ? unrelatedStartup.url : undefined) });
  const warm = gate();
  const restoration = gate();
  const restorationStarted = Promise.withResolvers<void>();
  const step = gate();
  let lost = 0;
  const restart = restartOf(client, "restoration");
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
    if (event.entered === "restoration") restorationStarted.resolve();
  });
  const work: Promise<unknown>[] = [];
  // Held work is rejected when the client stops; observe it from the start.
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  let edit: Promise<unknown> | undefined;
  try {
    const occupied = client.run("wait", { name: "warm", url: warm.url }, { resources: ["/same"] });
    await warm.entered.promise;
    // The overflow slot starts for disjoint background work, and its worker never becomes ready.
    track(
      client.withContinuation(
        () => client.run("value", { name: "unrelated" }, { resources: ["/unrelated"], priority: "background" }),
        { priority: "background" },
      ),
    );
    await unrelatedStartup.entered.promise;
    warm.release.resolve();
    await occupied;
    const original = client.withContinuation(
      () =>
        client.run(
          "wait",
          { name: "restoration", url: restoration.url },
          { resources: ["/same"], priority: "background" },
        ),
      { priority: "restoration" },
    );
    track(original);
    // The HTTP request can arrive before the worker event. Count the first entry before retiring it.
    await Promise.all([restoration.entered.promise, restorationStarted.promise]);
    edit = client.withContinuation(async () => {
      await client.run("wait", { name: "foreground", url: step.url }, { resources: ["/same"] });
      // Live restoration bars this peer, and no worker it needs is starting for the edit.
      const peer = client.run("value", { name: "peer" }, { resources: ["/same"], priority: "background" });
      await Promise.all([original, peer]);
    });
    await step.entered.promise;
    expect(lost).toBe(1);
    restoration.release.resolve();
    step.release.resolve();
    expect(await Promise.race([edit.then(() => "completed"), Bun.sleep(3_000).then(() => "stalled")])).toBe(
      "completed",
    );
    await restart.restarted;
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    restart.unsubscribe();
    for (const open of [warm, restoration, step, unrelatedStartup]) open.release.resolve();
    await client.stop();
    await Promise.allSettled([edit, ...work]);
  }
});

test("a build-admission retirement keeps the holder out of its preemptor's host gap", async () => {
  const client = fixture({ workers: 2 });
  const occupied = Promise.withResolvers<void>();
  const resumed = Promise.withResolvers<void>();
  const releaseHolder = Promise.withResolvers<void>();
  let holderCommands = 0;
  const builds = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      if (new URL(request.url).searchParams.get("worker") !== "holder") return new Response("ok");
      if (++holderCommands === preparationBuildConcurrency) occupied.resolve();
      if (holderCommands > preparationBuildConcurrency) resumed.resolve();
      await releaseHolder.promise;
      return new Response("ok");
    },
  });
  gates.push(builds);
  const commands = (name: string, resource: string, priority?: "background") =>
    client.run("commands", { name, url: builds.url.href }, { resources: [resource], priority });
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  const gap = Promise.withResolvers<void>();
  const nextStep = Promise.withResolvers<void>();
  const work: Promise<unknown>[] = [];
  // Held work is rejected when the client stops; observe it from the start.
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  try {
    await Promise.all(["a", "b"].map((name) => client.run("value", { name }, { resources: [name] })));
    // A live background continuation holds every build permit, as an attachment check building webviews does.
    track(client.withContinuation(() => commands("holder", "/holder", "background"), { priority: "background" }));
    await occupied.promise;
    const edit = client.withContinuation(async () => {
      await commands("edit-1", "/edit");
      gap.resolve();
      await nextStep.promise;
      await commands("edit-2", "/edit");
    });
    track(edit);
    await gap.promise;
    expect(await Promise.race([resumed.promise.then(() => "resumed"), Bun.sleep(700).then(() => "held")])).toBe("held");
    nextStep.resolve();
    await edit;
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    nextStep.resolve();
    releaseHolder.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("a preemptor step dispatched behind unrelated work restarts the interrupted job's hold", async () => {
  const client = fixture();
  const prior = gate();
  const step1 = gate();
  const step2 = gate();
  const unrelated = gate();
  const run = (name: string, url: string) => client.run("wait", { name, url }, { resources: ["/same"] });
  const restart = restartOf(client, "prior");
  const gap = Promise.withResolvers<void>();
  const later = Promise.withResolvers<void>();
  const queued = Promise.withResolvers<void>();
  const work: Promise<unknown>[] = [];
  // Held work is rejected when the client stops; observe it from the start.
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  let secondEnd = 0;
  try {
    const restoration = client.withContinuation(() => run("prior", prior.url), { priority: "restoration" });
    track(restoration);
    await prior.entered.promise;
    const edit = client.withContinuation(async () => {
      await run("step1", step1.url);
      gap.resolve();
      await later.promise;
      const step = run("step2", step2.url);
      queued.resolve();
      await step;
      secondEnd = performance.now();
      await restoration;
    });
    track(edit);
    await step1.entered.promise;
    prior.release.resolve();
    step1.release.resolve();
    await gap.promise;
    await Bun.sleep(100);
    track(run("unrelated", unrelated.url));
    await unrelated.entered.promise;
    later.resolve();
    await queued.promise;
    // A later job at the head of the queue stops the search before it reaches the held restoration.
    track(client.run("value", { name: "later" }, { resources: ["/same"] }));
    await Bun.sleep(120);
    unrelated.release.resolve();
    await step2.entered.promise;
    await Bun.sleep(450);
    step2.release.resolve();
    await edit;
    // The hold counts from the end of step 2, not from the idle time before it was dispatched.
    expect((await restart.restarted) - secondEnd).toBeGreaterThanOrEqual(PREPARATION_YIELD_HOLD_MS / 2);
  } finally {
    restart.unsubscribe();
    for (const open of [prior, step1, step2, unrelated]) open.release.resolve();
    later.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("cancelling the step a slot was retired for ends its startup credit", async () => {
  const replacement = gate();
  const client = fixture({ workers: 2, startupUrl: (worker) => (worker === 2 ? replacement.url : undefined) });
  const prior = gate();
  const controller = new AbortController();
  const cancelled = new Error("Cancel only the first edit step");
  let lost = 0;
  const restart = restartOf(client, "prior");
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  const gap = Promise.withResolvers<void>();
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  try {
    const restoration = track(
      client.withContinuation(() => client.run("wait", { name: "prior", url: prior.url }, { resources: ["/same"] }), {
        priority: "restoration",
      }),
    );
    await prior.entered.promise;
    const edit = track(
      client.withContinuation(async () => {
        // The first step retires the restoration and waits for a replacement worker that never starts.
        await client
          .run("value", { name: "cancelled-step" }, { resources: ["/same"], signal: controller.signal })
          .catch((error) => {
            if (error !== cancelled) throw error;
          });
        // Live restoration bars this sibling. Waiting for it must not keep the cancelled step's credit.
        const sibling = client.run("value", { name: "sibling" }, { resources: ["/same"], priority: "background" });
        gap.resolve();
        await Promise.all([restoration, sibling]);
      }),
    );
    await replacement.entered.promise;
    expect(lost).toBe(1);
    prior.release.resolve();
    controller.abort(cancelled);
    await gap.promise;
    expect(await Promise.race([edit.then(() => "completed"), Bun.sleep(3_000).then(() => "stalled")])).toBe(
      "completed",
    );
    await restart.restarted;
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    restart.unsubscribe();
    controller.abort(cancelled);
    prior.release.resolve();
    replacement.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  // The host configures a new worker factory while the edit's replacement worker is starting.
  "reconfigured",
  // The starting replacement worker exits; a busy peer slot leaves the edit's step queued.
  "lost-while-starting",
] as const)("an edit keeps its startup credit when its replacement worker is %s", async (mode) => {
  const attachment = gate();
  const first = gate();
  const second = gate();
  const other = gate();
  const workers: Worker[] = [];
  const firstReplacement = mode === "lost-while-starting" ? 3 : 2;
  const make = (startupUrl?: string) => {
    const worker = new Worker(
      new URL("./preparation-worker.fixture.ts", import.meta.url),
      startupUrl ? { workerData: { startupUrl } } : {},
    );
    workers.push(worker);
    return worker;
  };
  // The first replacement waits on the first gate; after it is lost, the next one waits on the second.
  const startupUrl = () => {
    if (workers.length === firstReplacement - 1) return first.url;
    if (mode === "lost-while-starting" && workers.length === firstReplacement) return second.url;
  };
  const client = createPreparationClient(() => make(startupUrl()), undefined, {
    workers: mode === "lost-while-starting" ? 2 : 1,
  });
  clients.push(client);
  const resources = mode === "lost-while-starting" ? ["/boundary"] : undefined;
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const attach = () =>
    client.withContinuation(
      () =>
        withBackgroundPreparation(() => client.run("wait", { name: "attachment", url: attachment.url }, { resources })),
      { priority: "background" },
    );
  let lost = 0;
  let attachments = 0;
  // Like the source watcher, every lost worker restores its watch and reconciles attachments.
  const unsubscribe = client.subscribe((event) => {
    if (event.entered === "attachment") attachments++;
    if (event.kind !== "worker-lost") return;
    lost++;
    const restored = track(
      client.withContinuation(() => client.run("value", { name: "restore" }, { priority: "background", resources }), {
        priority: "restoration",
      }),
    );
    track(restored.then(attach));
  });
  try {
    track(attach());
    await attachment.entered.promise;
    if (mode === "lost-while-starting") {
      track(client.run("wait", { name: "busy-peer", url: other.url }, { resources: ["/other"] }));
      await other.entered.promise;
    }
    const edit = track(
      client.withContinuation(() =>
        withBackgroundPreparation(async () => {
          for (let step = 0; step < 5; step++) {
            await client.run("value", { name: `edit-${step}` }, { resources });
            await Bun.sleep(1);
          }
        }),
      ),
    );
    await first.entered.promise;
    expect(lost).toBe(1);
    if (mode === "reconfigured") client.configureWorker(() => make(workers.length === 2 ? second.url : undefined));
    else void workers[firstReplacement - 1]!.terminate();
    await second.entered.promise;
    expect(lost).toBe(2);
    const before = attachments;
    // The second startup outlasts the hold; the edit's queued step still owns the slot it waits for.
    await Bun.sleep(PREPARATION_YIELD_HOLD_MS + 250);
    second.release.resolve();
    await edit;
    expect(attachments).toBe(before);
    expect(lost).toBe(2);
  } finally {
    unsubscribe();
    for (const open of [attachment, first, second, other]) open.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("an edit keeps its credit while a restoration occupies its ready replacement worker", async () => {
  const client = fixture();
  const attachment = gate();
  const restoration = gate();
  let lost = 0;
  let attachments = 0;
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const attach = () =>
    client.withContinuation(
      () => withBackgroundPreparation(() => client.run("wait", { name: "attachment", url: attachment.url })),
      { priority: "background" },
    );
  // The watcher's restoration runs first on the ready replacement and outlasts the hold.
  const unsubscribe = client.subscribe((event) => {
    if (event.entered === "attachment") attachments++;
    if (event.kind !== "worker-lost") return;
    lost++;
    const restored = track(
      client.withContinuation(
        () => client.run("wait", { name: "restore", url: restoration.url }, { priority: "background" }),
        { priority: "restoration" },
      ),
    );
    track(restored.then(attach));
  });
  try {
    track(attach());
    await attachment.entered.promise;
    let steps = 0;
    const edit = track(
      client.withContinuation(() =>
        withBackgroundPreparation(async () => {
          for (let step = 0; step < 5; step++) {
            await client.run("value", { name: `edit-${step}` });
            steps++;
            await Bun.sleep(1);
          }
        }),
      ),
    );
    await restoration.entered.promise;
    expect(lost).toBe(1);
    expect(steps).toBe(0);
    const before = attachments;
    await Bun.sleep(PREPARATION_YIELD_HOLD_MS + 200);
    restoration.release.resolve();
    await edit;
    expect(attachments).toBe(before);
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    attachment.release.resolve();
    restoration.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("a reserved queue head does not stop a later request from retiring its own blocker", async () => {
  const overflow = gate();
  const client = fixture({ workers: 2, startupUrl: (worker) => (worker === 2 ? overflow.url : undefined) });
  const attachment = gate();
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  try {
    track(
      client.withContinuation(
        () =>
          withBackgroundPreparation(() =>
            client.run("wait", { name: "attachment", url: attachment.url }, { resources: ["/primary"] }),
          ),
        { priority: "background" },
      ),
    );
    await attachment.entered.promise;
    // An older disjoint request is reserved on the overflow slot, whose worker never becomes ready.
    track(client.run("value", { name: "reserved" }, { resources: ["/overflow"] }));
    await overflow.entered.promise;
    // The reservation retires nothing for itself.
    expect(lost).toBe(0);
    const request = track(client.run("value", { name: "request" }, { resources: ["/primary"] }));
    expect(await Promise.race([request.then(() => "dispatched"), Bun.sleep(1_000).then(() => "waiting")])).toBe(
      "dispatched",
    );
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    attachment.release.resolve();
    overflow.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  // One worker: the restoration waiter lets the held job run before the reserved edit.
  ["single", 1_550],
  // Control: only the restoration's waiter is cancelled, so the edit runs first.
  ["single-cancel", 1_550],
  // A restoration occupies the edit's slot and another restoration waits on the held job.
  ["busy", 1_550],
  // As busy, with the edit's admission closed by an urgent continuation.
  ["busy-preserved", 1_550],
  // Control: no earlier barred request; the restoration's request retires the lower-ranked overflow job.
  ["head-clear", 550],
  // An earlier barred request precedes the eligible one; it must not hide it from preemption.
  ["head-barred", 550],
] as const)("held jobs and preemption stay available to restoration (%s)", async (mode, within) => {
  const held = gate();
  const overflow = gate();
  const occupant = gate();
  const startup = gate();
  const single = mode.startsWith("single");
  const head = mode.startsWith("head");
  const client = fixture({
    workers: single ? undefined : 2,
    startupUrl: (worker) => ((single || head) && worker === 2 ? startup.url : undefined),
  });
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const wait = (name: string, url: string, resource: string, options = {}) =>
    client.run<{ sequence: number }>("wait", { name, url }, { resources: [resource], ...options });
  const background = <T>(work: () => Promise<T>) =>
    client.withContinuation(() => withBackgroundPreparation(work), { priority: "background" });
  const edit = <T>(work: () => Promise<T>) => client.withContinuation(() => withBackgroundPreparation(work));
  const restore = <T>(work: () => Promise<T>) => client.withContinuation(work, { priority: "restoration" });
  const prior = () => wait("R", held.url, "/r");
  let lost = 0;
  const restart = restartOf(client, "R");
  const unsubscribe = client.subscribe((event) => {
    if (event.kind !== "worker-lost") return;
    lost++;
    if (!single && !head && lost === 1) track(restore(() => wait("Z", occupant.url, "/z")));
  });
  const settled = (promise: Promise<unknown>) =>
    Promise.race([promise.then(() => "dispatched"), Bun.sleep(within).then(() => "held")]);
  try {
    if (single) {
      const original = track(background(prior));
      await held.entered.promise;
      const request = track(
        edit(() => client.run<{ sequence: number }>("value", { name: "J" }, { resources: ["/r"] })),
      );
      await startup.entered.promise;
      const cancel = new AbortController();
      const restoring = track(restore(() => wait("R", held.url, "/r", { signal: cancel.signal })));
      const cancelled = mode === "single-cancel";
      if (cancelled) cancel.abort(new Error("restoration waiter cancelled"));
      const waited = cancelled ? expect(restoring).rejects.toBe(cancel.signal.reason) : restoring;
      held.release.resolve();
      startup.release.resolve();
      expect(await settled(Promise.all([original, request, waited]))).toBe("dispatched");
      expect((await request).sequence).toBe(cancelled ? 1 : 2);
      expect((await original).sequence).toBe(cancelled ? 2 : 1);
      expect(lost).toBe(1);
    } else if (head) {
      track(background(() => wait("G", overflow.url, "/g")));
      await overflow.entered.promise;
      track(restore(() => client.run("value", { name: "reserved" }, { resources: ["/x"] })));
      await startup.entered.promise;
      if (mode === "head-barred") track(edit(() => client.run("value", { name: "barred" }, { resources: ["/a"] })));
      const request = track(restore(() => client.run("value", { name: "eligible" }, { resources: ["/g"] })));
      expect(await settled(request)).toBe("dispatched");
      expect(lost).toBe(1);
    } else {
      track(background(prior));
      await held.entered.promise;
      const peer = track(background(() => wait("G", overflow.url, "/g")));
      await overflow.entered.promise;
      // Keep the occupant's scheduling from retiring the overflow job while the primary still retires.
      const keepPeer = new AbortController();
      track(wait("G", overflow.url, "/g", { signal: keepPeer.signal }));
      track(
        edit(() =>
          client.run(
            "value",
            { name: "J" },
            { resources: ["/r"], preserveActiveContinuation: mode === "busy-preserved" },
          ),
        ),
      );
      await occupant.entered.promise;
      expect(lost).toBe(1);
      keepPeer.abort();
      track(restore(prior));
      held.release.resolve();
      expect(await settled(restart.restarted)).toBe("dispatched");
      void peer;
    }
  } finally {
    unsubscribe();
    restart.unsubscribe();
    for (const open of [held, overflow, occupant, startup]) open.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  // One restoration: its only job runs on the ready replacement and outlasts the hold.
  "single-restore",
  // One restoration queues a second ordinary job behind its running first one.
  "same-owner",
  // A second restoration's job waits behind the first restoration's running job.
  "separate-owners",
] as const)("an edit keeps its credit while restoration work waits only for capacity (%s)", async (mode) => {
  const client = fixture();
  const attachment = gate();
  const first = gate();
  let lost = 0;
  let attachments = 0;
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const attach = () =>
    client.withContinuation(
      () => withBackgroundPreparation(() => client.run("wait", { name: "attachment", url: attachment.url })),
      { priority: "background" },
    );
  const restore = <T>(restoring: () => Promise<T>) => client.withContinuation(restoring, { priority: "restoration" });
  const blocking = () => client.run("wait", { name: "restore-first", url: first.url }, { priority: "background" });
  const following = () => client.run("value", { name: "restore-second" }, { priority: "background" });
  // Like the root and source watchers, each lost worker restores its watches before reconciling attachments.
  const unsubscribe = client.subscribe((event) => {
    if (event.entered === "attachment") attachments++;
    if (event.kind !== "worker-lost") return;
    lost++;
    const restored = track(
      mode === "same-owner" ? restore(() => Promise.all([blocking(), following()])) : restore(blocking),
    );
    if (mode === "separate-owners") track(restore(following));
    track(restored.then(attach));
  });
  try {
    track(attach());
    await attachment.entered.promise;
    let steps = 0;
    const edit = track(
      client.withContinuation(() =>
        withBackgroundPreparation(async () => {
          for (let step = 0; step < 5; step++) {
            await client.run("value", { name: `edit-${step}` });
            steps++;
            await Bun.sleep(1);
          }
        }),
      ),
    );
    await first.entered.promise;
    expect(lost).toBe(1);
    expect(steps).toBe(0);
    const before = attachments;
    await Bun.sleep(PREPARATION_YIELD_HOLD_MS + 200);
    first.release.resolve();
    await edit;
    expect(attachments).toBe(before);
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    attachment.release.resolve();
    first.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test("restoration uses ready overflow when it blocks a reserved edit still starting", async () => {
  const startup = gate();
  const client = fixture({ workers: 2, startupUrl: (worker) => (worker === 3 ? startup.url : undefined) });
  const primary = gate();
  const overflow = gate();
  const prior = gate();
  const peer = gate();
  const restart = restartOf(client, "held");
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const wait = (name: string, url: string, resource: string) =>
    client.run("wait", { name, url }, { resources: [resource] });
  const held = () => wait("held", prior.url, "/held");
  try {
    const warm = track(
      Promise.all([wait("warm-primary", primary.url, "/primary"), wait("warm-overflow", overflow.url, "/overflow")]),
    );
    await Promise.all([primary.entered.promise, overflow.entered.promise]);
    primary.release.resolve();
    overflow.release.resolve();
    await warm;

    track(client.withContinuation(() => withBackgroundPreparation(held), { priority: "background" }));
    await prior.entered.promise;
    const occupied = track(wait("peer", peer.url, "/peer"));
    await peer.entered.promise;
    track(
      client.withContinuation(() =>
        withBackgroundPreparation(() => client.run("value", { name: "edit" }, { resources: ["/edit"] })),
      ),
    );
    await startup.entered.promise;
    track(client.withContinuation(held, { priority: "restoration" }));
    prior.release.resolve();
    peer.release.resolve();
    await occupied;

    expect(await Promise.race([restart.restarted.then(() => "restarted"), Bun.sleep(1_550).then(() => "held")])).toBe(
      "restarted",
    );
  } finally {
    restart.unsubscribe();
    for (const pending of [startup, primary, overflow, prior, peer]) pending.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  "loan",
  "requested",
] as const)("a queued restoration that can run keeps the edit's hold intact (%s)", async (mode) => {
  const attachment = gate();
  const interrupted = gate();
  const blocker = gate();
  const client = fixture({ workers: 2 });
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const background = <T>(run: () => Promise<T>) =>
    client.withContinuation(() => withBackgroundPreparation(run), { priority: "background" });
  const restore = <T>(run: () => Promise<T>) => client.withContinuation(run, { priority: "restoration" });
  const coalesced = () =>
    client.run("wait", { name: "coalesced", url: interrupted.url }, { resources: ["/coalesced"] });
  const blocking = () => client.run("wait", { name: "restore-first", url: blocker.url });
  let scope: ReturnType<typeof createPreparationScope> | undefined;
  let releaseLoan: (() => void) | undefined;
  let lost = 0;
  let attachments = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.entered === "attachment") attachments++;
    if (event.kind === "worker-lost") lost++;
  });
  try {
    track(
      background(() => client.run("wait", { name: "attachment", url: attachment.url }, { resources: ["/attachment"] })),
    );
    await attachment.entered.promise;
    track(
      background(() => {
        scope = createPreparationScope();
        return scope.run(coalesced);
      }),
    );
    await interrupted.entered.promise;
    const edit = track(
      client.withContinuation(() =>
        withBackgroundPreparation(async () => {
          const caller = createPreparationScope();
          // The first, exclusive step retires both workers for the same edit.
          const step = client.run("value", { name: "edit-0" });
          if (mode === "loan") releaseLoan = scope!.request(caller);
          caller.dispose();
          await step;
          for (let index = 1; index < 5; index++) {
            await Bun.sleep(1);
            await client.run("value", { name: `edit-${index}` });
          }
        }),
      ),
    );
    expect(lost).toBe(1);
    // An exclusive restoration occupies the capacity the edit and second restoration need.
    track(restore(blocking));
    if (mode === "requested") track(blocking());
    await blocker.entered.promise;
    track(restore(coalesced));
    if (mode === "requested") track(coalesced());
    interrupted.release.resolve();

    await Bun.sleep(PREPARATION_YIELD_HOLD_MS + 200);
    blocker.release.resolve();
    await edit;
    expect(attachments).toBe(1);
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    releaseLoan?.();
    scope?.dispose();
    for (const pending of [attachment, interrupted, blocker]) pending.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  "workerless",
  "ready",
] as const)("an urgent resumed request can retire a blocker without a starting reservation (%s)", async (mode) => {
  const startup = gate();
  const replacementReady = Promise.withResolvers<void>();
  const client = fixture({
    workers: 2,
    startupUrl: (worker) => (mode === "ready" && worker === 3 ? startup.url : undefined),
    onWorkerReady: (worker) => {
      if (worker === 3) replacementReady.resolve();
    },
  });
  const primary = gate();
  const prior = gate();
  const restoring = gate();
  const allowRestore = Promise.withResolvers<void>();
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  const held = () => client.run("wait", { name: "held", url: prior.url }, { resources: ["/held"] });
  const edit = () =>
    client.run(
      "value",
      { name: "edit" },
      {
        resources: mode === "ready" ? ["/held"] : ["/held", "/primary"],
      },
    );
  try {
    const blocker = track(client.run("wait", { name: "primary", url: primary.url }, { resources: ["/primary"] }));
    await primary.entered.promise;
    track(client.withContinuation(() => withBackgroundPreparation(held), { priority: "background" }));
    await prior.entered.promise;
    track(client.withContinuation(() => withBackgroundPreparation(edit)));
    if (mode === "ready") await startup.entered.promise;
    track(
      client.withContinuation(
        async () => {
          await allowRestore.promise;
          return client.run("wait", { name: "restoring", url: restoring.url });
        },
        { priority: "restoration" },
      ),
    );
    if (mode === "ready") {
      // The restoration owns the continuation gap, so the edit stays parked when its worker becomes ready.
      startup.release.resolve();
      await replacementReady.promise;
    }
    allowRestore.resolve();
    primary.release.resolve();
    await blocker;
    await restoring.entered.promise;
    expect(lost).toBe(0);

    prior.release.resolve();
    const requested = track(mode === "ready" ? edit() : held());
    expect(await Promise.race([requested.then(() => "dispatched"), Bun.sleep(750).then(() => "held")])).toBe(
      "dispatched",
    );
    expect(lost).toBe(1);
  } finally {
    unsubscribe();
    allowRestore.resolve();
    for (const pending of [startup, primary, prior, restoring]) pending.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});

test.each([
  "resume",
  "independent-request",
  "overlapping-request",
] as const)("an urgent request keeps its retiring slot while other work uses compatible capacity (%s)", async (mode) => {
  const retirementEntered = Promise.withResolvers<void>();
  const retirementReleased = Promise.withResolvers<void>();
  const client = fixture({
    workers: 2,
    beforeWorkerTermination: (worker) => {
      if (worker !== 2) return undefined;
      retirementEntered.resolve();
      return retirementReleased.promise;
    },
  });
  const peer = gate();
  const prior = gate();
  const cancel = new AbortController();
  const work: Promise<unknown>[] = [];
  const track = <T>(promise: Promise<T>) => {
    work.push(promise.catch(() => undefined));
    return promise;
  };
  const background = <T>(run: () => Promise<T>) =>
    client.withContinuation(() => withBackgroundPreparation(run), { priority: "background" });
  const held = () => client.run("wait", { name: "held", url: prior.url }, { resources: ["/held"] });
  let lost = 0;
  const unsubscribe = client.subscribe((event) => {
    if (event.kind === "worker-lost") lost++;
  });
  try {
    track(background(() => client.run("wait", { name: "peer", url: peer.url }, { resources: ["/peer"] })));
    await peer.entered.promise;
    track(background(held));
    await prior.entered.promise;
    track(
      client.withContinuation(() =>
        withBackgroundPreparation(() =>
          client.run("value", { name: "edit" }, { resources: ["/held"], signal: cancel.signal }),
        ),
      ),
    );
    // Withdraw the edit and rejoin the interrupted job before its worker exits.
    cancel.abort();
    await retirementEntered.promise;
    const requested = track(held());
    expect(lost).toBe(0);
    let later: Promise<unknown> | undefined;
    if (mode !== "resume") {
      const resources = mode === "overlapping-request" ? ["/peer", "/held"] : ["/peer"];
      later = track(client.run("value", { name: "later" }, { resources }));
      if (mode === "overlapping-request") {
        expect(lost).toBe(0);
      } else {
        expect(await Promise.race([later.then(() => "dispatched"), Bun.sleep(750).then(() => "held")])).toBe(
          "dispatched",
        );
      }
    }
    retirementReleased.resolve();
    prior.release.resolve();
    await Promise.all([requested, later]);
    expect(lost).toBe(mode === "resume" ? 0 : 1);
  } finally {
    unsubscribe();
    retirementReleased.resolve();
    cancel.abort();
    prior.release.resolve();
    peer.release.resolve();
    await client.stop();
    await Promise.allSettled(work);
  }
});
