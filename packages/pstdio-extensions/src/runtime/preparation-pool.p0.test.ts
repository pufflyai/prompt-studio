import { afterEach, expect, test } from "bun:test";
import { Worker } from "node:worker_threads";
import { createPreparationClient } from "./preparation-client";

const clients: ReturnType<typeof createPreparationClient>[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  for (const server of servers.splice(0)) await server.stop(true);
});
const fixture = () => {
  const client = createPreparationClient(
    () => new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url)),
    undefined,
    { workers: 2 },
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
  servers.push(server);
  return { entered, release, url: server.url.href };
};

test("two independent preparations enter before either is released, and a third waits", async () => {
  const client = fixture();
  const gates = [gate(), gate(), gate()];
  const jobs = gates.map((g, i) => client.run("wait", { name: String(i), url: g.url }, { resources: [String(i)] }));
  try {
    await gates[0]!.entered.promise;
    await gates[1]!.entered.promise;
    expect(await Promise.race([gates[2]!.entered.promise.then(() => true), Bun.sleep(50).then(() => false)])).toBe(
      false,
    );
    gates[0]!.release.resolve();
    await gates[2]!.entered.promise;
  } finally {
    for (const g of gates) g.release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("same-source preparations serialize while another source makes progress", async () => {
  const client = fixture();
  const first = gate(),
    same = gate(),
    other = gate();
  const jobs = [
    client.run("wait", { name: "first", url: first.url }, { resources: ["source"] }),
    client.run("wait", { name: "same", url: same.url }, { resources: ["source/child"] }),
    client.run("wait", { name: "other", url: other.url }, { resources: ["other"] }),
  ];
  try {
    await other.entered.promise;
    expect(await Promise.race([same.entered.promise.then(() => true), Bun.sleep(50).then(() => false)])).toBe(false);
    first.release.resolve();
    await same.entered.promise;
  } finally {
    for (const g of [first, same, other]) g.release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("exclusive stateful work waits for both workers and blocks later independent work", async () => {
  const client = fixture();
  const a = gate(),
    b = gate(),
    exclusive = gate(),
    later = gate();
  const jobs = [
    client.run("wait", { name: "a", url: a.url }, { resources: ["a"] }),
    client.run("wait", { name: "b", url: b.url }, { resources: ["b"] }),
  ];
  await Promise.all([a.entered.promise, b.entered.promise]);
  jobs.push(client.run("wait", { name: "exclusive", url: exclusive.url }));
  jobs.push(client.run("wait", { name: "later", url: later.url }, { resources: ["later"] }));
  try {
    a.release.resolve();
    await jobs[0];
    expect(await Promise.race([exclusive.entered.promise.then(() => true), Bun.sleep(50).then(() => false)])).toBe(
      false,
    );
    b.release.resolve();
    await exclusive.entered.promise;
    expect(await Promise.race([later.entered.promise.then(() => true), Bun.sleep(50).then(() => false)])).toBe(false);
  } finally {
    for (const g of [a, b, exclusive, later]) g.release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("a failed worker leaves its peer and queued independent work alive", async () => {
  const client = fixture();
  const a = gate(),
    b = gate();
  const first = client.run("wait", { name: "a", url: a.url }, { resources: ["a"] });
  const peer = client.run("wait", { name: "b", url: b.url }, { resources: ["b"] });
  await Promise.all([a.entered.promise, b.entered.promise]);
  const failure = client.run("exit", {}, { resources: ["failure"] }).catch((error) => error);
  const queued = client.run("value", { name: "queued" }, { resources: ["queued"] });
  try {
    a.release.resolve();
    await first;
    expect(await failure).toMatchObject({ code: "extension_preparation_unavailable" });
    expect(await queued).toMatchObject({ name: "queued" });
    b.release.resolve();
    expect(await peer).toMatchObject({ name: "b", sequence: 1 });
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled([first, peer, failure, queued]);
  }
});

test("cancelling one worker's last owner does not retire its peer", async () => {
  const client = fixture();
  const a = gate(),
    b = gate();
  const controller = new AbortController();
  const cancelled = client
    .run("wait", { name: "a", url: a.url }, { resources: ["a"], signal: controller.signal })
    .catch((error) => error);
  const peer = client.run("wait", { name: "b", url: b.url }, { resources: ["b"] });
  try {
    await Promise.all([a.entered.promise, b.entered.promise]);
    controller.abort(new Error("Closed install"));
    expect(await cancelled).toMatchObject({ message: "Closed install" });
    expect(await client.run("value", { name: "next" }, { resources: ["next"] })).toMatchObject({ name: "next" });
    b.release.resolve();
    expect(await peer).toMatchObject({ name: "b", sequence: 1 });
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled([cancelled, peer]);
  }
});

test("an exclusive requested tool overtakes both background preparations", async () => {
  const client = fixture();
  const a = gate(),
    b = gate();
  const jobs = [a, b].map((g, i) =>
    client.run("wait", { name: String(i), url: g.url }, { priority: "background", resources: [String(i)] }),
  );
  try {
    await Promise.all([a.entered.promise, b.entered.promise]);
    expect(await client.run("value", { name: "tool" })).toMatchObject({ name: "tool" });
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("two execution owners share one 128-job waiting bound", async () => {
  const client = fixture();
  const a = gate(),
    b = gate();
  const active = [a, b].map((g, i) => client.run("wait", { name: String(i), url: g.url }, { resources: [String(i)] }));
  await Promise.all([a.entered.promise, b.entered.promise]);
  const pending = Array.from({ length: 128 }, (_, i) =>
    client.run("value", { name: `queued-${i}` }, { resources: [`queued-${i}`] }),
  );
  try {
    await expect(client.run("value", { name: "overflow" })).rejects.toMatchObject({
      code: "extension_preparation_unavailable",
    });
    a.release.resolve();
    b.release.resolve();
    expect(await Promise.all(pending)).toHaveLength(128);
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled([...active, ...pending]);
  }
});

test("build children from both workers share the host leaf limit", async () => {
  const { preparationBuildConcurrency } = await import("./preparation-command");
  const client = fixture();
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let total = 0,
    active = 0,
    maximum = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      total++;
      active++;
      maximum = Math.max(maximum, active);
      if (total === preparationBuildConcurrency) entered.resolve();
      await release.promise;
      active--;
      return new Response("done");
    },
  });
  servers.push(server);
  const jobs = ["a", "b"].map((name) =>
    client.run<{ exitCode: number }[]>("commands", { name, url: server.url.href }, { resources: [name] }),
  );
  try {
    await entered.promise;
    await Bun.sleep(50);
    expect(total).toBe(preparationBuildConcurrency);
    release.resolve();
    expect((await Promise.all(jobs)).flat().every((result) => result.exitCode === 0)).toBe(true);
    expect(total).toBe(8);
    expect(maximum).toBeLessThanOrEqual(preparationBuildConcurrency);
  } finally {
    release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("resource priority retires the conflicting owner and preserves the unrelated peer", async () => {
  const client = fixture(),
    a = gate(),
    b = gate();
  const first = client.run("wait", { name: "a", url: a.url }, { resources: ["a"], priority: "background" });
  const second = client.run("wait", { name: "b", url: b.url }, { resources: ["b"], priority: "background" });
  try {
    await Promise.all([a.entered.promise, b.entered.promise]);
    expect(await client.run("value", { name: "requested-b" }, { resources: ["b"] })).toMatchObject({
      name: "requested-b",
    });
    a.release.resolve();
    expect(await first).toMatchObject({ name: "a", sequence: 1 });
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled([first, second]);
  }
});

test("factory failure belongs to its execution owner while the healthy peer keeps queued work", async () => {
  let attempts = 0;
  const client = createPreparationClient(
    () => {
      if (++attempts === 2) throw new Error("Second worker unavailable");
      return new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url));
    },
    undefined,
    { workers: 2 },
  );
  clients.push(client);
  const blocked = gate();
  const held = client.run("wait", { name: "healthy", url: blocked.url }, { resources: ["a"] });
  await blocked.entered.promise;
  const failed = client.run("value", { name: "failed" }, { resources: ["b"] }).catch((error) => error);
  const queued = client.run("value", { name: "queued" });
  try {
    expect(await failed).toMatchObject({ message: "Second worker unavailable" });
    blocked.release.resolve();
    await held;
    expect(await queued).toMatchObject({ name: "queued" });
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([held, failed, queued]);
  }
});

test("a broader coalescing declaration cannot inherit a narrow parallel operation", async () => {
  const client = fixture(),
    blocked = gate();
  const input = { name: "same", url: blocked.url };
  const parallel = client.run("wait", input, { resources: ["source"] });
  await blocked.entered.promise;
  const exclusive = client.run<{ sequence: number }>("wait", input);
  try {
    blocked.release.resolve();
    await parallel;
    expect((await exclusive).sequence).toBe(2);
  } finally {
    blocked.release.resolve();
    await Promise.allSettled([parallel, exclusive]);
  }
});

test("requested build work cannot wait behind a speculative peer's leaf permits", async () => {
  const { preparationBuildConcurrency } = await import("./preparation-command");
  const client = fixture(),
    entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let count = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      if (new URL(request.url).searchParams.get("worker") === "background") {
        if (++count === preparationBuildConcurrency) entered.resolve();
        await release.promise;
      }
      return new Response("ready");
    },
  });
  servers.push(server);
  await Promise.all(["warm-a", "warm-b"].map((name) => client.run("value", { name }, { resources: [name] })));
  const background = client.run(
    "commands",
    { name: "background", url: server.url.href },
    { priority: "background", resources: ["background"] },
  );
  try {
    await entered.promise;
    const requested = client.run("commands", { name: "requested", url: server.url.href }, { resources: ["requested"] });
    await requested;
  } finally {
    release.resolve();
    await background;
  }
});

test("persistent replacement factory failures settle every queued owner", async () => {
  const client = fixture(),
    a = gate(),
    b = gate();
  const active = [a, b].map((g, i) => client.run("wait", { name: String(i), url: g.url }, { resources: [String(i)] }));
  await Promise.all([a.entered.promise, b.entered.promise]);
  const pending = Array.from({ length: 8 }, (_, i) =>
    client.run("value", { name: `queued-${i}` }, { resources: [`queued-${i}`] }).catch((error) => error),
  );
  client.configureWorker(() => {
    throw new Error("Factory unavailable");
  });
  try {
    a.release.resolve();
    b.release.resolve();
    await Promise.all(active);
    expect(
      (await Promise.all(pending)).every((error) => error instanceof Error && error.message === "Factory unavailable"),
    ).toBe(true);
  } finally {
    a.release.resolve();
    b.release.resolve();
    await Promise.allSettled([...active, ...pending]);
  }
});

test("retirement callbacks cannot start a third worker while commands are draining", async () => {
  let live = 0,
    maximum = 0;
  const client = createPreparationClient(
    () => {
      const worker = new Worker(new URL("./preparation-worker.fixture.ts", import.meta.url));
      maximum = Math.max(maximum, ++live);
      worker.once("exit", () => live--);
      return worker;
    },
    undefined,
    { workers: 2 },
  );
  clients.push(client);
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const { preparationBuildConcurrency } = await import("./preparation-command");
  let count = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async () => {
      if (++count === preparationBuildConcurrency) entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  servers.push(server);
  const jobs = ["a", "b"].map((name) =>
    client.run("commands", { name, url: server.url.href }, { priority: "background", resources: [name] }),
  );
  try {
    await entered.promise;
    await Bun.sleep(50);
    expect(await client.run("value", { name: "exclusive-request" })).toMatchObject({ name: "exclusive-request" });
    release.resolve();
    await Promise.all(jobs);
    expect(maximum).toBeLessThanOrEqual(2);
  } finally {
    release.resolve();
    await Promise.allSettled(jobs);
  }
});

test("primary watcher restoration can overtake a gated speculative peer after cancellation", async () => {
  const client = fixture(),
    primary = gate(),
    peerGate = gate(),
    controller = new AbortController();
  const first = client
    .run("wait", { name: "primary", url: primary.url }, { resources: ["primary"], signal: controller.signal })
    .catch((error) => error);
  const peer = client.run("wait", { name: "peer", url: peerGate.url }, { resources: ["peer"], priority: "background" });
  let restoration: Promise<unknown> | undefined;
  const stop = client.subscribe((event) => {
    if (event.kind === "worker-lost" && !restoration)
      restoration = client.withContinuation(
        () => client.run("value", { name: "restore" }, { priority: "background" }),
        { priority: "restoration" },
      );
  });
  try {
    await Promise.all([primary.entered.promise, peerGate.entered.promise]);
    controller.abort(new Error("Primary owner closed"));
    await first;
    const inventory = client.run("value", { name: "inventory" }, { preserveActiveContinuation: true });
    expect(await restoration).toMatchObject({ name: "restore" });
    expect(await inventory).toMatchObject({ name: "inventory" });
  } finally {
    stop();
    primary.release.resolve();
    peerGate.release.resolve();
    await Promise.allSettled([first, peer, restoration]);
  }
});
