import { expect, test } from "bun:test";
import { PassThrough, Writable } from "node:stream";
import { createCodexRuntime } from "./codex-runtime";
import { sink } from "./shared-server-peer";

const nativeResult = (message: { method: string; params: { threadId?: string } }, home?: string) => {
  switch (message.method) {
    case "config/read":
      return { config: {} };
    case "thread/start":
    case "thread/resume":
      return { thread: { id: message.params.threadId ?? `thread-${home}`, path: null }, model: "model" };
    case "thread/read":
      return { thread: { id: message.params.threadId, turns: [] } };
    case "thread/goal/get":
      return { goal: null };
    default:
      return {};
  }
};

test("a failed cleanup waits for every environment before allowing follow-up startup", async () => {
  let replySlow: (() => void) | undefined;
  const slowRequested = Promise.withResolvers<void>();
  const runtime = createCodexRuntime({
    spawnProcess: (_args, options) => {
      const home = options?.env?.CODEX_HOME;
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const exited = Promise.withResolvers<{ code: number | null; signal: string | null }>();
      const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`);
      const kill = () => {
        stdout.end();
        stderr.end();
        exited.resolve({ code: null, signal: "SIGTERM" });
      };
      const stdin = new Writable({
        write(chunk, _encoding, done) {
          const message = JSON.parse(String(chunk));
          if (message.id === undefined) {
            done();
            return;
          }
          if (message.method === "thread/unsubscribe" && home === "slow") {
            replySlow = () => emit({ id: message.id, result: {} });
            slowRequested.resolve();
            done();
            return;
          }
          if (message.method === "thread/unsubscribe" && home === "fail")
            emit({ id: message.id, error: { message: "unsubscribe rejected" } });
          else emit({ id: message.id, result: nativeResult(message, home) });
          done();
        },
      });
      return { stdin, stdout, stderr, kill, pid: home === "fail" ? 1 : 2, onExit: exited.promise };
    },
  });
  const input = (home: string) => ({
    prompt: "",
    events: sink(),
    env: { CODEX_HOME: home, PSTDIO_SESSION_ID: "s", PSTDIO_PROJECT_ID: "p" },
  });
  try {
    const failInput = input("fail");
    const slowInput = input("slow");
    await runtime.worker(failInput).load(failInput);
    const oldSlow = runtime.worker(slowInput);
    const id = await oldSlow.load(slowInput);
    let settled = false;
    const releasing = runtime.releaseSession("p", "s").catch((error: Error) => {
      settled = true;
      return error.message;
    });
    await slowRequested.promise;
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(settled).toBe(false);
    replySlow?.();
    expect(await releasing).toContain("cleanup failed");
    expect(oldSlow.isClosed()).toBe(true);
    const resumedInput = { ...slowInput, agentSessionId: id };
    expect(await runtime.worker(resumedInput).load(resumedInput)).toBe(id);
  } finally {
    await runtime.dispose();
  }
});
