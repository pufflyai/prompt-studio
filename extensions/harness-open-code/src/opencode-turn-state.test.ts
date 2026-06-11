import { describe, expect, it } from "bun:test";
import { isTurnCompleted, isTurnInFlight, isTurnStale, resolveInFlightTurnProgressAt } from "./opencode-turn-state";
import type { OpencodeSessionMessage } from "./opencode-types";

const assistantMessage = (
  overrides: Partial<{
    completed: number;
    created: number;
    parts: { type: string; tool?: string; state?: { status?: string } }[];
  }> = {},
): OpencodeSessionMessage => ({
  info: {
    role: "assistant",
    time: {
      created: overrides.created ?? 1_700_000_000_000,
      completed: overrides.completed,
    },
  },
  parts: overrides.parts ?? [{ type: "text" }],
});

describe("isTurnInFlight", () => {
  it("returns false for empty messages", () => {
    expect(isTurnInFlight([])).toBe(false);
  });

  it("returns false when the trailing message is not an assistant", () => {
    const messages: OpencodeSessionMessage[] = [{ role: "user", content: [{ type: "text" }] }];
    expect(isTurnInFlight(messages)).toBe(false);
  });

  it("returns true when the assistant message has no completed timestamp", () => {
    expect(isTurnInFlight([assistantMessage()])).toBe(true);
  });

  it("returns false when the assistant message has a completed timestamp", () => {
    expect(isTurnInFlight([assistantMessage({ completed: 1_700_000_001_000 })])).toBe(false);
  });

  it("returns false for assistant messages in role/content format", () => {
    const messages: OpencodeSessionMessage[] = [{ role: "assistant", content: [{ type: "text", text: "done" }] }];
    expect(isTurnInFlight(messages)).toBe(false);
  });

  it("returns false when the assistant message contains a question tool part", () => {
    const msg = assistantMessage({
      parts: [{ type: "text" }, { type: "tool", tool: "question", state: { status: "completed" } }],
    });
    expect(isTurnInFlight([msg])).toBe(false);
  });

  it("returns false for question tool regardless of case", () => {
    const msg = assistantMessage({
      parts: [{ type: "tool", tool: "Question" }],
    });
    expect(isTurnInFlight([msg])).toBe(false);
  });

  it("returns true when there is a non-question tool part and no completed timestamp", () => {
    const msg = assistantMessage({
      parts: [{ type: "tool", tool: "bash", state: { status: "running" } }],
    });
    expect(isTurnInFlight([msg])).toBe(true);
  });

  it("returns true when question and active non-question tool parts are both present", () => {
    const msg = assistantMessage({
      parts: [
        { type: "tool", tool: "question", state: { status: "completed" } },
        { type: "tool", tool: "bash", state: { status: "running" } },
      ],
    });

    expect(isTurnInFlight([msg])).toBe(true);
  });
});

describe("isTurnCompleted", () => {
  it("returns false for empty messages", () => {
    expect(isTurnCompleted([])).toBe(false);
  });

  it("returns false when the trailing message is a user message", () => {
    const messages: OpencodeSessionMessage[] = [{ role: "user", content: [{ type: "text" }] }];
    expect(isTurnCompleted(messages)).toBe(false);
  });

  it("returns false when the assistant message has no completed timestamp and no question", () => {
    expect(isTurnCompleted([assistantMessage()])).toBe(false);
  });

  it("returns true when the assistant message has a completed timestamp", () => {
    expect(isTurnCompleted([assistantMessage({ completed: 1_700_000_001_000 })])).toBe(true);
  });

  it("returns true for assistant messages in role/content format", () => {
    const messages: OpencodeSessionMessage[] = [{ role: "assistant", content: [{ type: "text", text: "done" }] }];
    expect(isTurnCompleted(messages)).toBe(true);
  });

  it("returns true when the assistant message contains a question tool part", () => {
    const msg = assistantMessage({
      parts: [{ type: "tool", tool: "question", state: { status: "completed" } }],
    });
    expect(isTurnCompleted([msg])).toBe(true);
  });

  it("returns false when question has active non-question tool parts", () => {
    const msg = assistantMessage({
      parts: [
        { type: "tool", tool: "question", state: { status: "completed" } },
        { type: "tool", tool: "bash", state: { status: "running" } },
      ],
    });
    expect(isTurnCompleted([msg])).toBe(false);
  });
});

describe("isTurnStale", () => {
  it("returns false when progressAt is null", () => {
    expect(isTurnStale(null, Date.now(), 30_000)).toBe(false);
  });

  it("returns true when elapsed time exceeds timeout", () => {
    const now = 1_700_000_060_000;
    const progressAt = 1_700_000_000_000;
    expect(isTurnStale(progressAt, now, 30_000)).toBe(true);
  });

  it("returns false when elapsed time is within timeout", () => {
    const now = 1_700_000_010_000;
    const progressAt = 1_700_000_000_000;
    expect(isTurnStale(progressAt, now, 30_000)).toBe(false);
  });
});

describe("resolveInFlightTurnProgressAt", () => {
  it("returns null when the turn is not in flight", () => {
    const result = resolveInFlightTurnProgressAt({
      rawMessages: [assistantMessage({ completed: 1_700_000_001_000 })],
      lastProgressAt: null,
      snapshotChanged: false,
      now: 1_700_000_002_000,
    });
    expect(result).toBeNull();
  });

  it("returns null when the turn has a question (not in-flight)", () => {
    const msg = assistantMessage({
      parts: [{ type: "tool", tool: "question" }],
    });
    const result = resolveInFlightTurnProgressAt({
      rawMessages: [msg],
      lastProgressAt: null,
      snapshotChanged: false,
      now: 1_700_000_002_000,
    });
    expect(result).toBeNull();
  });

  it("returns created timestamp when first seen in-flight", () => {
    const result = resolveInFlightTurnProgressAt({
      rawMessages: [assistantMessage({ created: 1_700_000_000_000 })],
      lastProgressAt: null,
      snapshotChanged: false,
      now: 1_700_000_002_000,
    });
    expect(result).toBe(1_700_000_000_000);
  });

  it("returns now when snapshot changed while in-flight", () => {
    const now = 1_700_000_005_000;
    const result = resolveInFlightTurnProgressAt({
      rawMessages: [assistantMessage()],
      lastProgressAt: 1_700_000_000_000,
      snapshotChanged: true,
      now,
    });
    expect(result).toBe(now);
  });
});
