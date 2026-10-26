import { expect, test } from "bun:test";
import type { HarnessContext } from "@pstdio/sdk/extensions";
import { createPiHarness } from "./harness";
import { piRecords, piRequest } from "./process";
import { startPiTurn } from "./turn";

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
  await expect(turn.session).rejects.toThrow();
  await expect(turn.done).rejects.toThrow();
  await turn.stop();
});

test("rejects an early process exit and malformed protocol", async () => {
  for (const source of ["process.exit(7)", "console.log('invalid json')"]) {
    const turn = startPiTurn(
      { prompt: "hello", sessionId: "early", events: { getMessages: () => [], push() {} } },
      { command: [process.execPath, "-e", source, "--"] },
    );
    await expect(turn.session).rejects.toThrow();
    await expect(turn.done).rejects.toThrow();
  }
});

test("RPC failures reject and terminate the process", async () => {
  const source = `process.stdin.on('data', () => console.log(JSON.stringify({type:'response', id:'request', success:false, error:'Rejected'})));`;
  await expect(piRequest("get_messages", [], { command: [process.execPath, "-e", source, "--"] })).rejects.toThrow(
    "Rejected",
  );
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
