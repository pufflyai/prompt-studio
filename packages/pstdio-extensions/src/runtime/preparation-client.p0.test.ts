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

const clients: ReturnType<typeof createPreparationClient>[] = [];
const gates: ReturnType<typeof Bun.serve>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  for (const gate of gates.splice(0)) await gate.stop(true);
});
const fixture = () => {
  const client = createPreparationClient(() => new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url)));
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
