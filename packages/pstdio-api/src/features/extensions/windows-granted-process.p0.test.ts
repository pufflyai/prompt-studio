import { expect, test } from "bun:test";
import { startWindowsGrantedProcess, watchJobExit } from "./windows-granted-process";

test("a fresh job accounting check can confirm cleanup after a failed query", async () => {
  const failure = new Error("fixture accounting query failed");
  const failed = Promise.withResolvers<unknown>();
  let queries = 0;
  let closed = 0;
  const job = {
    hasProcesses() {
      if (++queries === 1) throw failure;
      return false;
    },
    close() {
      closed++;
    },
  };
  const tracking = watchJobExit(job, Promise.resolve(), failed.resolve);
  let verified = false;
  void tracking.treeExited.then(() => {
    verified = true;
  });
  expect(await failed.promise).toBe(failure);
  expect(verified).toBe(false);
  expect(closed).toBe(0);

  await tracking.check();
  await tracking.treeExited;
  expect(queries).toBe(2);
  expect(verified).toBe(true);
  expect(closed).toBe(1);
});

test.each([
  { code: 0, disconnect: false },
  { code: 1, disconnect: false },
  { code: 7, disconnect: true },
])("retains natural exit $code while stopping the rest of the job (disconnect=$disconnect)", async ({
  code,
  disconnect,
}) => {
  let remaining = true;
  let stops = 0;
  let reported: number | undefined;
  const disconnected = Promise.withResolvers<void>();
  const spawner = ((argv, options) =>
    Bun.spawn(argv, {
      ...options,
      ipc: (message, launcher) => {
        if (typeof message?.exitCode === "number") reported = message.exitCode;
        if (typeof options?.ipc === "function") options.ipc(message, launcher);
        if (disconnect && typeof message?.pid === "number") launcher.disconnect();
      },
      onDisconnect: () => {
        options?.onDisconnect?.();
        disconnected.resolve();
      },
    })) as typeof Bun.spawn;
  const processChild = startWindowsGrantedProcess(
    {
      spawner,
      command: { argv: [process.execPath, "-e", `await Bun.stdin.text(); process.exit(${code});`] },
      env: process.env,
      detached: false,
      stdin: "pipe",
      stopTimeoutMs: 5_000,
    },
    () => ({
      attachLauncher() {},
      hasProcesses: () => remaining,
      terminate() {
        stops++;
        remaining = false;
      },
      close() {},
    }),
  );
  try {
    await processChild.pid;
    if (disconnect) await disconnected.promise;
    const input = processChild.child.stdin;
    if (!input || typeof input === "number") throw new Error("Expected a launcher stdin pipe.");
    await input.end();
    expect(await processChild.exited).toBe(code);
    expect(await processChild.child.exited).toBe(code);
    expect(reported).toBe(disconnect ? undefined : code);
    expect(remaining).toBe(true);
    await processChild.stop();
    expect(stops).toBe(1);
  } finally {
    remaining = false;
    await processChild.treeExited;
  }
});

test("a job stop keeps the numeric launcher exit when there is no natural exit report", async () => {
  let launcher: ReturnType<typeof Bun.spawn> | undefined;
  let remaining = true;
  const spawner = ((_, options) => {
    // Model the OS termination result but keep the launcher handshake and disconnect on real IPC.
    launcher = Bun.spawn(
      [
        process.execPath,
        "-e",
        'process.once("message", async () => { process.send({ pid: process.pid }); await Bun.stdin.text(); process.exit(1); });',
      ],
      options,
    );
    return launcher;
  }) as typeof Bun.spawn;
  const child = startWindowsGrantedProcess(
    {
      spawner,
      command: { argv: [process.execPath, "--version"] },
      env: process.env,
      detached: false,
      stdin: "pipe",
      stopTimeoutMs: 5_000,
    },
    () => ({
      attachLauncher() {},
      hasProcesses: () => remaining,
      terminate() {
        remaining = false;
        if (launcher?.stdin && typeof launcher.stdin !== "number") launcher.stdin.end();
      },
      close() {},
    }),
  );
  try {
    await child.pid;
    await child.stop();
    expect(await child.exited).toBe(1);
  } finally {
    await child.stop();
  }
});
