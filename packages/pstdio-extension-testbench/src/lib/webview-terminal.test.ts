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

  test("treats unknown sessions as end-of-stream", async () => {
    const host = createPreviewWebviewTerminalHost();
    await expect(host.session({ op: "next-event", sessionId: "missing" })).resolves.toEqual({
      op: "event",
      event: null,
    });
  });
});
