import { expect, test } from "bun:test";
import { stopWindowsProcessTree } from "./windows-process-tree";

const hangingProcess = () =>
  Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], { stdout: "ignore", stderr: "ignore" });

test("stops the root and waits for its exit after the native tree stop", async () => {
  const child = hangingProcess();
  try {
    await stopWindowsProcessTree(child, async () => {
      child.kill("SIGKILL");
      return { exitCode: 0, output: "" };
    });
    expect(await child.exited).toBeDefined();
    expect(() => process.kill(child.pid, 0)).toThrow();
  } finally {
    child.kill("SIGKILL");
    await child.exited;
  }
});

test("reports every refused PID that survives after the root exits", async () => {
  const child = hangingProcess();
  const survivor = hangingProcess();
  try {
    const failure = await stopWindowsProcessTree(child, async () => ({
      exitCode: 1,
      output: `ERROR: The process with PID ${survivor.pid} could not be terminated.`,
    })).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(String(survivor.pid));
    expect(() => process.kill(child.pid, 0)).toThrow();
  } finally {
    child.kill("SIGKILL");
    survivor.kill("SIGKILL");
    await Promise.all([child.exited, survivor.exited]);
  }
});

test("ignores a refused PID only after that process has already exited", async () => {
  const child = hangingProcess();
  await stopWindowsProcessTree(child, async () => {
    child.kill("SIGKILL");
    await child.exited;
    return { exitCode: 1, output: `ERROR: The process with PID ${child.pid} could not be terminated.` };
  });
  expect(() => process.kill(child.pid, 0)).toThrow();
});

test("checks taskkill targets without treating their parent PIDs as survivors", async () => {
  const child = hangingProcess();
  const exitedTarget = hangingProcess();
  exitedTarget.kill("SIGKILL");
  await exitedTarget.exited;
  try {
    await stopWindowsProcessTree(child, async () => {
      child.kill("SIGKILL");
      await child.exited;
      return {
        exitCode: 128,
        output:
          `SUCCESS: The process with PID ${child.pid} (child process of PID ${process.pid}) has been terminated.\n` +
          `ERROR: The process with PID ${exitedTarget.pid} could not be terminated.\n` +
          "Reason: There is no running instance of the task.\n",
      };
    });
    expect(() => process.kill(child.pid, 0)).toThrow();
    expect(() => process.kill(process.pid, 0)).not.toThrow();
  } finally {
    child.kill("SIGKILL");
    exitedTarget.kill("SIGKILL");
    await Promise.all([child.exited, exitedTarget.exited]);
  }
});

test.skipIf(process.platform !== "win32")("native taskkill ends the root and its spawned child", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    const descendant = Bun.spawn([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { stdout: 'ignore', stderr: 'ignore' });
    process.stdout.write(String(descendant.pid));
    setInterval(() => {}, 1000);
  `,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  let descendantPid = 0;
  try {
    const reader = child.stdout.getReader();
    const first = await reader.read();
    reader.releaseLock();
    descendantPid = Number(new TextDecoder().decode(first.value));
    expect(descendantPid).toBeGreaterThan(0);
    const started = performance.now();
    await stopWindowsProcessTree(child);
    process.stderr.write(
      `${JSON.stringify({ event: "process.tree.native.stop", elapsedMs: performance.now() - started })}\n`,
    );
    expect(() => process.kill(child.pid, 0)).toThrow();
    expect(() => process.kill(descendantPid, 0)).toThrow();
  } finally {
    child.kill("SIGKILL");
    if (descendantPid) {
      try {
        process.kill(descendantPid, "SIGKILL");
      } catch {}
    }
    await child.exited;
  }
});
