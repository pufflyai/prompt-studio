import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import { diagnosticChatFrames } from "./chat-stream-diagnostics";

test("large chat events report encoding cost and sizes without retaining conversation text", () => {
  const events: unknown[] = [];
  const observer = (event: unknown) => events.push(event);
  const source = channel("pstdio.diagnostics.operation");
  source.subscribe(observer);
  try {
    const notice = "private conversation text ".repeat(4000);
    const frames = [...diagnosticChatFrames("session-id", { revision: 0, snapshot: { notice } })];
    expect(frames.length).toBeGreaterThan(1);
    expect(events).toHaveLength(frames.length + 1);
    expect(events.at(-1)).toMatchObject({
      kind: "chat.encode",
      fragments: frames.length,
      failed: false,
      sessionId: "session-id",
    });
    const record = events.at(-1) as { logicalBytes: number; wireBytes: number; durationMs: number };
    expect(record.logicalBytes).toBeGreaterThan(64 * 1024);
    expect(record.wireBytes).toBeGreaterThan(record.logicalBytes);
    expect(record.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(events)).not.toContain("private conversation text");
  } finally {
    source.unsubscribe(observer);
  }
});

test("encoding progress is available while a fragment is still awaiting delivery", () => {
  const events: unknown[] = [];
  const observer = (event: unknown) => events.push(event);
  const source = channel("pstdio.diagnostics.operation");
  source.subscribe(observer);
  const frames = diagnosticChatFrames("session-id", { revision: 2, snapshot: { notice: "large".repeat(30_000) } });
  try {
    expect(frames.next().done).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "chat.encode", complete: false, fragments: 1 });
  } finally {
    source.unsubscribe(observer);
    frames.return();
  }
});
