import { describe, expect, test } from "bun:test";
import { createScriptedTerminalBridge } from "./scripted-bridge";

const decode = (chunk: Uint8Array) => new TextDecoder().decode(chunk);

const collectData = (session: { onData(handler: (chunk: Uint8Array) => void): () => void }) => {
  const chunks: string[] = [];
  session.onData((chunk) => chunks.push(decode(chunk)));
  return chunks;
};

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("scripted terminal bridge", () => {
  test("delivers initial steps after subscribers attach", async () => {
    const bridge = createScriptedTerminalBridge({ initial: [{ data: "welcome\r\n" }] });
    const session = await bridge.openSession({ cols: 80, rows: 24 });
    const chunks = collectData(session);

    await flushMicrotasks();

    expect(chunks.join("")).toBe("welcome\r\n");
  });

  test("delivers initial steps when the subscriber attaches after open settles", async () => {
    const bridge = createScriptedTerminalBridge({ initial: [{ data: "welcome\r\n" }] });
    const session = await bridge.openSession({ cols: 80, rows: 24 });

    await flushMicrotasks();
    const chunks = collectData(session);
    await flushMicrotasks();

    expect(chunks.join("")).toBe("welcome\r\n");
  });

  test("echoes user input by default", async () => {
    const bridge = createScriptedTerminalBridge();
    const session = await bridge.openSession({ cols: 80, rows: 24 });
    const chunks = collectData(session);

    session.write("hi\r");
    await flushMicrotasks();

    expect(chunks.join("")).toBe("hi\r\n");
  });

  test("emits exit and stops further data", async () => {
    const bridge = createScriptedTerminalBridge({
      initial: [{ data: "first" }, { exit: { code: 0 } }, { data: "after-exit" }],
    });
    const session = await bridge.openSession({ cols: 80, rows: 24 });
    const chunks = collectData(session);
    const exits: Array<{ code: number | null; signal: string | null }> = [];
    session.onExit((exit) => exits.push(exit));

    await flushMicrotasks();

    expect(chunks.join("")).toBe("first");
    expect(exits).toEqual([{ code: 0, signal: null }]);
  });

  test("kill triggers a single exit event and host hook", async () => {
    const kills: Array<string | undefined> = [];
    const bridge = createScriptedTerminalBridge({ onKill: (signal) => kills.push(signal) });
    const session = await bridge.openSession({ cols: 80, rows: 24 });
    const exits: Array<{ code: number | null; signal: string | null }> = [];
    session.onExit((exit) => exits.push(exit));

    await session.kill("SIGTERM");
    await session.kill("SIGTERM");

    expect(exits).toEqual([{ code: null, signal: "SIGTERM" }]);
    expect(kills).toEqual(["SIGTERM"]);
  });

  test("resize hook is invoked with the requested geometry", async () => {
    const resizes: Array<{ cols: number; rows: number }> = [];
    const bridge = createScriptedTerminalBridge({
      onResize: (size) => resizes.push(size),
    });
    const session = await bridge.openSession({ cols: 80, rows: 24 });

    session.resize(120, 40);

    expect(resizes).toEqual([{ cols: 120, rows: 40 }]);
  });

  test("data emitted after unsubscribe is not delivered", async () => {
    const bridge = createScriptedTerminalBridge();
    const session = await bridge.openSession({ cols: 80, rows: 24 });

    const chunks: string[] = [];
    const unsubscribe = session.onData((chunk) => chunks.push(decode(chunk)));
    unsubscribe();

    session.write("noop\r");
    await flushMicrotasks();

    expect(chunks).toEqual([]);
  });
});
