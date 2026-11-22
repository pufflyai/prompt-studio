import { expect, spyOn, test } from "bun:test";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { fileTurnFixture } from "./file-turns.test-fixture";
import { createInstanceCommands } from "./instance-commands";
import { createInstances } from "./instances";

test("a fresh instance starts and stops with the released CLI's no-state status output", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "pc-cli-state-"));
  const id = randomUUID();
  const directory = join(root, id);
  const binary = join(root, "controller.ts");
  await fs.mkdir(directory);
  await fs.writeFile(join(directory, "empty.env"), "");
  await fs.writeFile(
    binary,
    `#!${process.execPath}
import { mkdir, rm, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.includes("status")) {
  if (!(await Bun.file("state/server.json").exists())) { console.error("server is not running (no managed server state)"); process.exit(1); }
  console.log(JSON.stringify({ state: "running" }));
}
if (args.includes("start")) {
  await mkdir("state", { recursive: true });
  await writeFile("state/server.json", JSON.stringify({ pid: ${process.pid} }));
}
if (args.includes("stop")) await rm("state/server.json");
if (args.includes("superuser")) console.log(JSON.stringify({ token: "fixture", key: { expires_at: "2099-01-01T00:00:00Z" } }));
`,
    { mode: 0o700 },
  );
  await fs.writeFile(
    join(directory, "instance.json"),
    JSON.stringify({
      id,
      name: "Fresh fixture",
      binary,
      state: "stopped",
      url: "http://127.0.0.1:4000",
      agentPort: 4001,
    }),
  );
  try {
    const instances = createInstances(root);
    expect(await instances.start(id)).toMatchObject({ state: "running" });
    expect(await instances.stop(id)).toMatchObject({ state: "stopped" });
    expect(await Bun.file(join(directory, "state/server.json")).exists()).toBe(false);
    expect(await instances.start(id)).toMatchObject({ state: "running" });
    expect(await instances.stop(id)).toMatchObject({ state: "stopped" });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Stop reports a missing executable instead of claiming a live controller stopped", async () => {
  const f = await fileTurnFixture(() => Response.json({}));
  try {
    await fs.writeFile(
      join(f.root, f.ref.instanceId, "instance.json"),
      JSON.stringify({
        id: f.ref.instanceId,
        binary: join(f.root, "missing-controller"),
        state: "running",
      }),
    );
    const command = createInstanceCommands(() => f.ref.instances).stopInstance;
    const ctx = makeCommandContext({ storage: createMemoryStorage(), params: {} });
    await expect(command.run(ctx, { instanceId: f.ref.instanceId })).rejects.toThrow("executable not found");
  } finally {
    await f.close();
  }
});

test("session readers see a complete binding while a replacement write is in progress", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "pc-binding-"));
  const instances = createInstances(root);
  const session = randomUUID(),
    instance = randomUUID(),
    machine = randomUUID();
  const oldConversation = randomUUID(),
    nextConversation = randomUUID();
  await instances.bindSession(session, instance, machine, oldConversation);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const write = fs.writeFile;
  const writing = spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
    if (String(args[0]).startsWith(join(root, `${session}.json`))) {
      await write(args[0], "", args[2]);
      entered.resolve();
      await release.promise;
    }
    return write(...args);
  });
  const binding = instances.bindSession(session, instance, machine, nextConversation);
  try {
    await entered.promise;
    expect(await instances.sessionTarget(session)).toEqual({
      instanceId: instance,
      machineId: machine,
      conversationId: oldConversation,
    });
    release.resolve();
    await binding;
    expect(await instances.sessionTarget(session)).toEqual({
      instanceId: instance,
      machineId: machine,
      conversationId: nextConversation,
    });
  } finally {
    release.resolve();
    await binding;
    writing.mockRestore();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test.each([
  "probe-failed",
  "still-running",
  "unhealthy",
])("failed launch preserves recovery state when stop is not confirmed (%s)", async (mode) => {
  const root = await fs.mkdtemp(join(tmpdir(), "pc-rollback-"));
  const binary = join(root, "controller.ts");
  const instancesRoot = join(root, "instances");
  let directory = "";
  const server = Bun.serve({
    port: 0,
    async fetch() {
      await fs.writeFile(join(directory, "mode"), mode);
      return Response.json(
        { error: { code: "publish_failed", message: "Template publication failed" } },
        { status: 503 },
      );
    },
  });
  await fs.writeFile(
    binary,
    `#!${process.execPath}
import { mkdir, readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (args.includes("status")) {
  const mode = await readFile("mode", "utf8").catch(() => "");
  if (mode === "probe-failed") { console.error("Status unavailable"); process.exit(2); }
  if (mode === "unhealthy") { console.log(JSON.stringify({ state: "unhealthy" })); process.exit(1); }
  const running = await Bun.file("state/server.json").exists();
  console.log(JSON.stringify({ state: running ? "running" : "not_running" }));
  process.exit(running ? 0 : 1);
}
if (args.includes("start")) {
  await mkdir("state", { recursive: true });
  await writeFile("state/server.json", JSON.stringify({ pid: ${process.pid} }));
}
if (args.includes("superuser")) console.log(JSON.stringify({ token: "fixture", key: { expires_at: "2099-01-01T00:00:00Z" } }));
`,
    { mode: 0o700 },
  );
  try {
    const instances = createInstances(instancesRoot);
    const allocate = async () => {
      directory = join(instancesRoot, (await fs.readdir(instancesRoot))[0]!);
      return server.port!;
    };
    let allocations = 0;
    const result = await instances
      .launch({ name: "Rollback fixture", binary, manifests: [{}] }, async () => {
        const port = await allocate();
        return allocations++ === 0 ? port : port + 1;
      })
      .catch((error: unknown) => error);
    expect(result).toBeInstanceOf(Error);
    expect(await fs.readdir(instancesRoot)).toHaveLength(1);
    expect(await Bun.file(join(directory, "instance.json")).exists()).toBe(true);
    expect(await Bun.file(join(directory, "state/server.json")).exists()).toBe(true);
  } finally {
    server.stop(true);
    await fs.rm(root, { recursive: true, force: true });
  }
});

test.each([
  "deadline",
  "caller",
])("controller reads retain both their transport deadline and caller cancellation (%s)", async (cause) => {
  const entered = Promise.withResolvers<void>();
  const f = await fileTurnFixture(() => {
    entered.resolve();
    return new Promise<Response>(() => {});
  });
  const caller = new AbortController(),
    deadline = new AbortController();
  const delays: number[] = [];
  const timeout = spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    delays.push(ms);
    return deadline.signal;
  });
  const result = f.ref.instances
    .request(f.ref.instanceId, "/stalled", { signal: caller.signal })
    .catch((error: unknown) => error);
  try {
    await entered.promise;
    expect(delays).toEqual([35_000]);
    const reason = new DOMException("Fixture interruption", cause === "deadline" ? "TimeoutError" : "AbortError");
    (cause === "deadline" ? deadline : caller).abort(reason);
    expect(await result).toBe(reason);
  } finally {
    caller.abort();
    await result;
    timeout.mockRestore();
    await f.close();
  }
});
