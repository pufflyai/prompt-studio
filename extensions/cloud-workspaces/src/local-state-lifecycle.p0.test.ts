import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeControllerFixture } from "./controller.test-fixture";
import { createInstances } from "./instances";

async function controllerFixture() {
  const root = await fs.mkdtemp(join(tmpdir(), "pc-state-races-"));
  const id = randomUUID();
  const directory = join(root, id);
  await fs.mkdir(directory);
  await fs.writeFile(join(directory, "empty.env"), "");
  const binary = await writeControllerFixture(
    root,
    `import { mkdir, rm, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.includes("status")) { const running = await Bun.file("state/server.json").exists(); console.log(JSON.stringify({ state: running ? "running" : "not_running" })); process.exit(running ? 0 : 1); }
if (args.includes("start")) {
  await writeFile("start-entered", "yes");
  while (await Bun.file("hold-start").exists() && !(await Bun.file("allow-start").exists())) await Bun.sleep(5);
  await mkdir("state", { recursive: true }); await writeFile("state/server.json", JSON.stringify({ pid: ${process.pid} }));
}
if (args.includes("stop")) await rm("state/server.json", { force: true });
if (args.includes("superuser")) console.log(JSON.stringify({ token: "fixture", key: { expires_at: "2099-01-01T00:00:00Z" } }));
`,
  );
  await fs.writeFile(
    join(directory, "instance.json"),
    JSON.stringify({ id, name: "Saved", binary, state: "stopped", url: "http://127.0.0.1:4000", agentPort: 4001 }),
  );
  return { root, directory, id, binary, instances: createInstances(root) };
}

test("the saved instance list stays available while another launch allocates ports", async () => {
  const f = await controllerFixture();
  const entered = Promise.withResolvers<void>();
  const port = Promise.withResolvers<number>();
  const stop = new Error("Fixture ends before startup");
  const launch = f.instances
    .launch({ name: "Preparing", binary: f.binary }, () => {
      entered.resolve();
      return port.promise;
    })
    .catch((error: unknown) => error);
  try {
    await entered.promise;
    expect((await f.instances.list()).map((instance) => instance.id)).toEqual([f.id]);
    port.reject(stop);
    expect(await launch).toBe(stop);
  } finally {
    port.reject(stop);
    await launch;
    await fs.rm(f.root, { recursive: true, force: true });
  }
});

test("start and remove from separate instance handles cannot hide a running controller", async () => {
  const f = await controllerFixture();
  await fs.writeFile(join(f.directory, "hold-start"), "yes");
  const starting = f.instances.start(f.id);
  let removing: Promise<unknown> | undefined;
  try {
    while (!(await Bun.file(join(f.directory, "start-entered")).exists())) await Bun.sleep(5);
    removing = createInstances(f.root)
      .remove(f.id)
      .then(
        () => null,
        (error: unknown) => error,
      );
    await Promise.race([removing, Bun.sleep(50)]);
    await fs.writeFile(join(f.directory, "allow-start"), "yes");
    expect(await starting).toMatchObject({ state: "running" });
    expect(await removing).toBeInstanceOf(Error);
    expect((await f.instances.list()).map((instance) => instance.id)).toEqual([f.id]);
  } finally {
    await fs.writeFile(join(f.directory, "allow-start"), "yes");
    await Promise.allSettled([starting, removing]);
    await fs.rm(f.root, { recursive: true, force: true });
  }
});

test("an implicit binding refresh cannot overwrite a concurrent explicit conversation bind", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "pc-binding-race-"));
  const first = createInstances(root),
    second = createInstances(root);
  const session = randomUUID(),
    instance = randomUUID(),
    machine = randomUUID();
  const old = randomUUID(),
    current = randomUUID();
  await first.bindSession(session, instance, machine, old);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const read = fs.readFile;
  let held = false;
  const holdRead = async (...args: Parameters<typeof fs.readFile>) => {
    const data = await read(...args);
    if (!held && String(args[0]) === join(root, `${session}.json`)) {
      held = true;
      entered.resolve();
      await release.promise;
    }
    return data;
  };
  const reading = spyOn(fs, "readFile").mockImplementation(holdRead as typeof fs.readFile);
  const implicit = first.bindSession(session, instance, machine);
  let explicit: Promise<void> | undefined;
  try {
    await entered.promise;
    explicit = second.bindSession(session, instance, machine, current);
    await Promise.race([explicit, Bun.sleep(50)]);
    release.resolve();
    await Promise.all([implicit, explicit]);
    expect(await first.sessionTarget(session)).toMatchObject({ conversationId: current });
  } finally {
    release.resolve();
    try {
      await Promise.allSettled([implicit, explicit]);
    } finally {
      reading.mockRestore();
      await fs.rm(root, { recursive: true, force: true });
    }
  }
});

test("a failed launch keeps directory deletion serialized against a queued restart", async () => {
  const f = await controllerFixture();
  let directory = "",
    id = "",
    allocations = 0;
  const deleting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ error: { code: "publish_failed", message: "Rejected template" } }, { status: 503 }),
  });
  const rm = fs.rm;
  const removing = spyOn(fs, "rm").mockImplementation(async (...args: Parameters<typeof fs.rm>) => {
    if (String(args[0]) === directory) {
      deleting.resolve();
      await release.promise;
    }
    return rm(...args);
  });
  const launch = f.instances
    .launch({ name: "Failed launch", binary: f.binary, manifests: [{}] }, async () => {
      id = (await fs.readdir(f.root)).find((name) => name !== f.id && /^[0-9a-f-]{36}$/.test(name))!;
      directory = join(f.root, id);
      return allocations++ === 0 ? server.port! : server.port! + 1;
    })
    .catch((error: unknown) => error);
  let starting: Promise<unknown> | undefined;
  try {
    await deleting.promise;
    starting = createInstances(f.root)
      .start(id)
      .catch((error: unknown) => error);
    await Promise.race([starting, Bun.sleep(500)]);
    release.resolve();
    expect(await launch).toBeInstanceOf(Error);
    expect(await starting).toBeInstanceOf(Error);
    expect(await Bun.file(join(directory, "instance.json")).exists()).toBe(false);
  } finally {
    release.resolve();
    try {
      await Promise.allSettled([launch, starting]);
    } finally {
      removing.mockRestore();
      await server.stop(true);
      await fs.rm(f.root, { recursive: true, force: true });
    }
  }
});

test("inventory skips a manifest removed before its status refresh", async () => {
  const f = await controllerFixture();
  const read = fs.readFile;
  let removed = false;
  const removeAfterRead = async (...args: Parameters<typeof fs.readFile>) => {
    const data = await read(...args);
    if (!removed && String(args[0]) === join(f.directory, "instance.json")) {
      removed = true;
      await fs.rm(f.directory, { recursive: true });
    }
    return data;
  };
  const reading = spyOn(fs, "readFile").mockImplementation(removeAfterRead as typeof fs.readFile);
  try {
    expect(await f.instances.list()).toEqual([]);
  } finally {
    reading.mockRestore();
    await fs.rm(f.root, { recursive: true, force: true });
  }
});

test("inventory preserves corrupt manifest errors", async () => {
  const f = await controllerFixture();
  try {
    await fs.writeFile(join(f.directory, "instance.json"), "{");
    await expect(f.instances.list()).rejects.toBeInstanceOf(SyntaxError);
  } finally {
    await fs.rm(f.root, { recursive: true, force: true });
  }
});
