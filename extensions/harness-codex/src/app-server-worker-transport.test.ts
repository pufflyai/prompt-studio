import { afterEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createCodexRuntime } from "./codex-runtime";

const runtimes: ReturnType<typeof createCodexRuntime>[] = [];
afterEach(async () => {
  for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

const startPeer = async (mode: string, intercept?: (child: ReturnType<typeof spawn>) => void) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./app-server-fixture.ts", import.meta.url))], {
    stdio: "pipe",
    env: { ...process.env, PSTDIO_TEST_MODE: mode },
  });
  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const runtime = createCodexRuntime({
    spawnProcess: () => ({
      stdin: child.stdin!,
      stdout: child.stdout!,
      stderr: child.stderr!,
      pid: child.pid,
      kill: () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        if (mode === "async-cleanup-error") child.stdin!.write(`${JSON.stringify({ method: "fixture/stop" })}\n`);
        else child.kill();
      },
      onExit,
    }),
  });
  runtimes.push(runtime);
  intercept?.(child);
  const session = await runtime.run({ prompt: "Continue", events: { getMessages: () => [], push: () => {} } });
  return { child, session, onExit, runtime };
};

test("transport loss stays disconnected when stopping the real peer produces a nonzero exit", async () => {
  const { child, session, onExit, runtime } = await startPeer("async-cleanup-error");
  child.stdout!.destroy(new Error("Protocol read failed"));
  const result = await session.done;
  await runtime.dispose();
  expect((await onExit).code).toBe(1);
  expect(result).toEqual({ status: "disconnected" });
  expect(() => process.kill(child.pid!, 0)).toThrow();
});

test("a native turn failure leaves its shared transport alive until runtime disposal", async () => {
  const { child, session, runtime } = await startPeer("fail");
  expect(await session.done).toEqual({ status: "failed" });
  expect(() => process.kill(child.pid!, 0)).not.toThrow();
  await runtime.dispose();
  expect(() => process.kill(child.pid!, 0)).toThrow();
});

test("runtime disposal waits for transport retirement after a lost turn acknowledgement", async () => {
  const { child, session, runtime } = await startPeer("async-cleanup-error", (child) => {
    const stdin = child.stdin!;
    const write = stdin.write.bind(stdin);
    stdin.write = ((chunk: unknown) => {
      const sent = write(chunk);
      if (JSON.parse(String(chunk)).method === "turn/start")
        child.stdout!.destroy(new Error("Protocol read failed before acknowledgement"));
      return sent;
    }) as typeof stdin.write;
  });
  expect(await session.done).toEqual({ status: "disconnected" });
  await runtime.dispose();
  expect(child.exitCode).toBe(1);
  expect(() => process.kill(child.pid!, 0)).toThrow();
});
