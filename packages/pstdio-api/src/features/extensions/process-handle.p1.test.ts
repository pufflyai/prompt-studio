import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProcessEvent } from "pstdio-api-contracts/extension-kernel";
import { expectRejection } from "../../test-utils/expect-rejection";
import { spawnProcessHandle } from "./process-handle";

let root: string;
const env = { PATH: process.env.PATH ?? "" };
const bun = (script: string, ...args: string[]) => ({ argv: [process.execPath, join(root, script), ...args], env });

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "process-handle-"));
  await writeFile(
    join(root, "echo.ts"),
    `for await (const chunk of Bun.stdin.stream()) process.stdout.write(new TextDecoder().decode(chunk).toUpperCase());
process.stderr.write("done");`,
  );
  await writeFile(
    join(root, "flood.ts"),
    `const block = "x".repeat(64 * 1024);
for (let i = 0; i < 64; i++) await new Promise((resolve) => process.stdout.write(block, resolve));
await Bun.write(process.argv[2], "finished");`,
  );
  await writeFile(
    join(root, "background.ts"),
    `Bun.spawn([process.execPath, "-e", "setTimeout(() => {}, 6000)"], { stdout: "inherit", stderr: "inherit" }).unref();
process.stdout.write("hi");`,
  );
  await writeFile(
    join(root, "holder.ts"),
    `Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "inherit", stderr: "inherit" });
process.stdout.write("x".repeat(1024 * 1024));
setInterval(() => {}, 1000);`,
  );
  await writeFile(
    join(root, "stubborn.ts"),
    `Bun.spawn([process.execPath, "-e", "process.on('SIGTERM', () => {}); await Bun.write(process.argv[1], String(process.pid)); setInterval(() => {}, 1000);", process.argv[2]], { stdout: "ignore", stderr: "ignore" });
setInterval(() => {}, 1000);`,
  );
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const collect = async (events: AsyncIterable<ProcessEvent>) => {
  const seen: ProcessEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
};
const text = (events: ProcessEvent[], type: "stdout" | "stderr") =>
  events
    .filter((event): event is Extract<ProcessEvent, { data: Uint8Array }> => event.type === type)
    .map((event) => new TextDecoder().decode(event.data))
    .join("");

test("a child receives incremental stdin and its output arrives in order before the final exit", async () => {
  const handle = spawnProcessHandle(bun("echo.ts"));
  await handle.started;
  const output = collect(handle.events());
  await handle.write("hello ");
  await handle.write(new TextEncoder().encode("world"));
  await handle.end();
  await handle.end();
  await expectRejection(handle.write("late")).toThrow("closed");
  const events = await output;
  expect(text(events, "stdout")).toBe("HELLO WORLD");
  expect(text(events, "stderr")).toBe("done");
  expect(events.at(-1)).toEqual({ type: "exit", exit: { code: 0, signal: null } });
  expect(await handle.exited).toEqual({ code: 0, signal: null });
  expect(() => handle.events()).toThrow("one output consumer");
});

test("input written before end() reaches the child even when nobody awaited it", async () => {
  const handle = spawnProcessHandle(bun("echo.ts"));
  const output = collect(handle.events());
  const pending = handle.write("queued");
  await handle.end();
  await pending;
  expect(text(await output, "stdout")).toBe("QUEUED");
});

const alive = (pid: number) => {
  // A killed grandchild may still have a zombie entry while the OS reaps it.
  const stat = Bun.spawnSync(["ps", "-o", "stat=", "-p", String(pid)])
    .stdout.toString()
    .trim();
  return stat !== "" && !stat.startsWith("Z");
};

test.skipIf(process.platform === "win32")(
  "kill also stops a grandchild that ignores the first signal after its parent exited",
  async () => {
    const pidFile = join(root, "stubborn-pid");
    const handle = spawnProcessHandle(bun("stubborn.ts", pidFile));
    await handle.started;
    for (let attempt = 0; !existsSync(pidFile) && attempt < 100; attempt++) await Bun.sleep(20);
    const grandchild = Number(await Bun.file(pidFile).text());
    expect(alive(grandchild)).toBe(true);
    await handle.kill();
    expect(alive(grandchild)).toBe(false);
  },
);

test("an absent consumer pauses the child instead of buffering without bound", async () => {
  const marker = join(root, "flood-finished");
  const handle = spawnProcessHandle(bun("flood.ts", marker), { creditBytes: 16 * 1024 });
  await Bun.sleep(800);
  expect(existsSync(marker)).toBe(false);
  const events = await collect(handle.events());
  expect(text(events, "stdout").length).toBe(64 * 64 * 1024);
  expect(events.every((event) => event.type === "exit" || event.data.byteLength <= 16 * 1024)).toBe(true);
  expect(existsSync(marker)).toBe(true);
});

test("kill finishes despite unread output and a grandchild holding the pipes", async () => {
  const handle = spawnProcessHandle(bun("holder.ts"), { creditBytes: 1024 });
  await handle.started;
  await Bun.sleep(300);
  const started = performance.now();
  await handle.kill();
  await handle.kill();
  expect(performance.now() - started).toBeLessThan(5_000);
  const exit = await handle.exited;
  expect(exit.code === 0).toBe(false);
  const events = await collect(handle.events());
  expect(events.at(-1)?.type).toBe("exit");
});

test("a background child holding the output open does not keep the exit from arriving", async () => {
  const handle = spawnProcessHandle(bun("background.ts"));
  const started = performance.now();
  const events = await collect(handle.events());
  expect(performance.now() - started).toBeLessThan(4_000);
  expect(text(events, "stdout")).toBe("hi");
  expect(events.at(-1)).toEqual({ type: "exit", exit: { code: 0, signal: null } });
});

test("exited settles when the child exits even if nobody reads its output", async () => {
  const marker = join(root, "unread-finished");
  const handle = spawnProcessHandle(bun("flood.ts", marker), { creditBytes: 16 * 1024 });
  await handle.kill("SIGKILL");
  expect(await handle.exited).toMatchObject({ code: null });
  for (const finish of ["read", "discard"] as const) {
    const quiet = spawnProcessHandle(
      { argv: [process.execPath, "-e", "process.stdout.write('x'.repeat(65536))"], env },
      { creditBytes: 1024 },
    );
    try {
      expect(await quiet.exited).toEqual({ code: 0, signal: null });
      const confirmed = quiet.treeExited!.then(() => "confirmed");
      expect(await Promise.race([confirmed, Bun.sleep(100).then(() => "backpressured")])).toBe("backpressured");
      if (finish === "read") expect(text(await collect(quiet.events()), "stdout")).toHaveLength(65536);
      else {
        await quiet.kill();
        expect(await collect(quiet.events())).toEqual([{ type: "exit", exit: { code: 0, signal: null } }]);
      }
      expect(await confirmed).toBe("confirmed");
    } finally {
      await quiet.kill();
    }
  }
});

test("a command that cannot start rejects started with a code and still reports an exit", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const handle = spawnProcessHandle({ argv: [join(root, "missing-command")], env });
    // The Windows launcher reports this failure over IPC. Await that reply before matching it.
    await expectRejection(handle.started).toMatchObject({ code: "process_command_not_found" });
    expect(await handle.exited).toEqual({ code: null, signal: null });
    expect(await collect(handle.events())).toEqual([{ type: "exit", exit: { code: null, signal: null } }]);
    await expectRejection(handle.write("x")).toThrow();
    await handle.kill();
    await Bun.sleep(20);
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("return ends every pending output read without stopping a quiet child", async () => {
  const handle = spawnProcessHandle(bun("echo.ts"));
  try {
    const iterator = handle.events()[Symbol.asyncIterator]();
    const reads = Promise.all([iterator.next(), iterator.next()]);
    expect(await iterator.return?.()).toMatchObject({ done: true });
    expect(await Promise.race([reads, Bun.sleep(100).then(() => "still reading")])).toEqual([
      { done: true, value: undefined },
      { done: true, value: undefined },
    ]);
    expect(await handle.write("still running")).toBeUndefined();
  } finally {
    await handle.kill("SIGKILL");
  }
});

test.skipIf(process.platform === "win32")(
  "kill reports failure if it cannot confirm even the direct child stopped",
  async () => {
    const quiet = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const handle = spawnProcessHandle(
      { argv: ["owned-fixture"], env },
      {
        // Own a real fixture, but simulate a platform that cannot deliver the signal through its handle.
        spawner: (() => ({
          pid: quiet.pid,
          stdin: quiet.stdin,
          stdout: quiet.stdout,
          stderr: quiet.stderr,
          exited: quiet.exited,
          get signalCode() {
            return quiet.signalCode;
          },
          kill() {},
        })) as unknown as typeof Bun.spawn,
      },
    );
    const result = handle.kill("SIGKILL").then(
      () => "stopped",
      (error: Error) => error.message,
    );
    try {
      expect(await Promise.race([result, Bun.sleep(1_000).then(() => "pending")])).toBe(
        "The process tree did not stop.",
      );
    } finally {
      quiet.kill("SIGKILL");
      await quiet.exited;
      await result;
    }
  },
);
