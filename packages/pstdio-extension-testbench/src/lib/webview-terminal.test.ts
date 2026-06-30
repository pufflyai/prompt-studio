import { describe, expect, test } from "bun:test";
import type { TerminalEvent } from "@pstdio/sdk/extensions";
import { createPreviewWebviewTerminalHost } from "./webview-terminal";

const decodeData = (event: TerminalEvent | null) => {
  if (!event || event.kind !== "data") return null;
  return new TextDecoder().decode(event.chunk);
};

const openSession = async (host: ReturnType<typeof createPreviewWebviewTerminalHost>) => {
  const opened = await host.session({ op: "open", request: { cols: 80, rows: 24 } });
  if (opened.op !== "open") throw new Error("expected open result");
  return opened.sessionId;
};

const drainEvents = async (host: ReturnType<typeof createPreviewWebviewTerminalHost>, sessionId: string) => {
  const events: TerminalEvent[] = [];
  while (true) {
    const result = await host.session({ op: "next-event", sessionId });
    if (result.op !== "event" || !result.event) return events;
    events.push(result.event);
    if (result.event.kind === "exit") return events;
  }
};

const withTimeout = async <T>(promise: Promise<T>) => {
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50));
  return Promise.race([promise, timeout]);
};

describe("createPreviewWebviewTerminalHost", () => {
  test("echoes writes back as data events without a real shell", async () => {
    const host = createPreviewWebviewTerminalHost();
    const sessionId = await openSession(host);

    expect(await host.session({ op: "write", sessionId, data: "hello\n" })).toEqual({ op: "ack" });
    expect(await host.session({ op: "resize", sessionId, cols: 120, rows: 40 })).toEqual({ op: "ack" });
    expect(await host.session({ op: "kill", sessionId })).toEqual({ op: "ack" });

    const events = await drainEvents(host, sessionId);
    expect(decodeData(events[0] ?? null)).toBe("hello\n");
    expect(events.at(-1)).toEqual({ kind: "exit", code: 0, signal: null });
  });

  test("runs scripted events deterministically and signals end-of-stream", async () => {
    const host = createPreviewWebviewTerminalHost({
      script: () => [
        { kind: "data", chunk: new TextEncoder().encode("scripted line\n") },
        { kind: "exit", code: 2, signal: null },
      ],
    });
    const sessionId = await openSession(host);
    const events = await drainEvents(host, sessionId);

    expect(decodeData(events[0] ?? null)).toBe("scripted line\n");
    expect(events.at(-1)).toEqual({ kind: "exit", code: 2, signal: null });

    // After exit the host releases the session and reports end-of-stream.
    const trailing = await host.session({ op: "next-event", sessionId });
    expect(trailing).toEqual({ op: "event", event: null });
  });

  test("closes pending scripted sessions on kill", async () => {
    const host = createPreviewWebviewTerminalHost({
      script: async function* () {
        yield { kind: "data", chunk: new TextEncoder().encode("waiting\n") } satisfies TerminalEvent;
        await new Promise(() => {});
      },
    });
    const sessionId = await openSession(host);

    const first = await host.session({ op: "next-event", sessionId });
    if (first.op !== "event") throw new Error("expected event result");
    expect(decodeData(first.event)).toBe("waiting\n");

    const pending = host.session({ op: "next-event", sessionId });
    expect(await host.session({ op: "kill", sessionId })).toEqual({ op: "ack" });

    await expect(pending).resolves.toEqual({ op: "event", event: null });
    await expect(host.session({ op: "next-event", sessionId })).resolves.toEqual({ op: "event", event: null });
  });

  test("resolves overlapping next-event waiters", async () => {
    const host = createPreviewWebviewTerminalHost();
    const sessionId = await openSession(host);

    const first = host.session({ op: "next-event", sessionId });
    const second = host.session({ op: "next-event", sessionId });

    await host.session({ op: "write", sessionId, data: "first" });
    await host.session({ op: "write", sessionId, data: "second" });

    const results = await withTimeout(Promise.all([first, second]));
    expect(results).not.toBe("timeout");
    if (results === "timeout") return;
    expect(results.map((result) => (result.op === "event" ? decodeData(result.event) : null))).toEqual([
      "first",
      "second",
    ]);
  });

  test("closes overlapping next-event waiters on exit", async () => {
    const host = createPreviewWebviewTerminalHost();
    const sessionId = await openSession(host);

    const first = host.session({ op: "next-event", sessionId });
    const second = host.session({ op: "next-event", sessionId });

    await host.session({ op: "kill", sessionId });

    const results = await withTimeout(Promise.all([first, second]));
    expect(results).not.toBe("timeout");
    if (results === "timeout") return;
    expect(results).toEqual([
      { op: "event", event: { kind: "exit", code: 0, signal: null } },
      { op: "event", event: null },
    ]);
  });

  test("rejects operations from a different webview owner", async () => {
    const host = createPreviewWebviewTerminalHost();
    const opened = await host.session({ op: "open", request: { cols: 80, rows: 24 } }, "webview-a");
    if (opened.op !== "open") throw new Error("expected open result");

    await expect(host.session({ op: "write", sessionId: opened.sessionId, data: "oops" }, "webview-b")).rejects.toThrow(
      /does not own terminal session/,
    );
  });

  test("treats unknown sessions as end-of-stream", async () => {
    const host = createPreviewWebviewTerminalHost();
    await expect(host.session({ op: "next-event", sessionId: "missing" })).resolves.toEqual({
      op: "event",
      event: null,
    });
  });
});
