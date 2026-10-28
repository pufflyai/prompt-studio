import { expect, spyOn, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createPiHarness } from "./harness";
import { piRecords, piRequest, startPiProcess } from "./process";
import { startPiTurn } from "./turn";

const expectRejectedTurn = async (turn: ReturnType<typeof startPiTurn>) => {
  // Settle pipe-dependent results before assertions; Bun promise assertions can nest the I/O loop.
  const failures = await Promise.all(
    [turn.session, turn.done].map((pending) =>
      pending.then(
        () => null,
        (error: unknown) => error,
      ),
    ),
  );
  for (const failure of failures) expect(failure).toBeInstanceOf(Error);
};

test("decodes split UTF-8 and keeps Unicode separators inside JSON records", async () => {
  const bytes = Buffer.from(`${JSON.stringify({ text: "å\u2028inside\u2029" })}\r\n${JSON.stringify({ type: "end" })}`);
  async function* chunks() {
    for (const byte of bytes) yield Buffer.from([byte]);
  }
  expect(await Array.fromAsync(piRecords(chunks()))).toEqual([{ text: "å\u2028inside\u2029" }, { type: "end" }]);
});

test("rejects a missing executable without leaving startup pending", async () => {
  const turn = startPiTurn(
    { prompt: "hello", sessionId: "missing", events: { getMessages: () => [], push() {} } },
    { command: ["pstdio-pi-missing-executable"] },
  );
  await expectRejectedTurn(turn);
  await turn.stop();
});

test("rejects an early process exit and malformed protocol", async () => {
  for (const source of ["process.exit(7)", "console.log('invalid json')"]) {
    const turn = startPiTurn(
      { prompt: "hello", sessionId: "early", events: { getMessages: () => [], push() {} } },
      { command: [process.execPath, "-e", source, "--"] },
    );
    await expectRejectedTurn(turn);
  }
});

test("RPC failures reject and terminate the process", async () => {
  const source = `process.stdin.on('data', () => console.log(JSON.stringify({type:'response', id:'request', success:false, error:'Rejected'})));`;
  const failure = await piRequest("get_messages", [], { command: [process.execPath, "-e", source, "--"] }).then(
    () => null,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain("Rejected");
});

test("disposal stops pending history requests immediately", async () => {
  const controller = new AbortController();
  const harness = createPiHarness({
    command: [process.execPath, "-e", "process.stdin.resume(); setInterval(() => {}, 1000)", "--"],
    signal: controller.signal,
  });
  const context = { projectId: "pending" } as HarnessContext;
  const pending = Promise.resolve(harness.getMessages!(context, { agentSessionId: "native" })).then(
    () => "completed",
    () => "stopped",
  );
  try {
    await harness.dispose!(context);
    expect(await Promise.race([pending, Bun.sleep(100).then(() => "still running")])).toBe("stopped");
  } finally {
    controller.abort();
    await pending;
  }
});

test("an unexpected process signal reports failure", async () => {
  const source = `console.log(JSON.stringify({type:'session', id:'native'})); setTimeout(() => process.kill(process.pid, 'SIGKILL'), 20);`;
  const turn = startPiTurn(
    { prompt: "hello", sessionId: "crash", events: { getMessages: () => [], push() {} } },
    { command: [process.execPath, "-e", source, "--"] },
  );
  const session = await turn.session;
  expect(await session.done).toEqual({ status: "failed" });
});

test.skipIf(process.platform !== "darwin")(
  "cleanup signals its owned child when macOS refuses a group signal",
  async () => {
    const worker = startPiProcess([], {
      command: [process.execPath, "-e", "process.stdin.resume(); setInterval(() => {}, 1000)"],
    });
    const pid = worker.child.pid!;
    const kill = process.kill.bind(process);
    const signals = spyOn(process, "kill").mockImplementation((target, signal) => {
      if (target === -pid) throw Object.assign(new Error("Group is exiting"), { code: "EPERM" });
      return kill(target, signal);
    });
    try {
      await worker.stop();
      expect((await worker.exited).signal).toBe("SIGTERM");
      expect(signals).toHaveBeenCalledWith(-pid, "SIGTERM");
    } finally {
      signals.mockRestore();
      try {
        kill(pid, "SIGKILL");
      } catch {}
      await worker.exited;
    }
  },
);
