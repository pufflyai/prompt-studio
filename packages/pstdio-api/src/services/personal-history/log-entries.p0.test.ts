import { expect, test } from "bun:test";
import { batchLines, messageEntries, readLines } from "./log-entries";

test("completed messages round trip through bounded log updates, including large Unicode tool output", () => {
  const message = {
    id: "message",
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: '😀\\"\n'.repeat(300_000) }],
  };
  const lines = messageEntries(0, message);
  expect(readLines(lines)).toEqual([message]);
  expect([...batchLines(lines)]).toEqual([lines]);
});

test("late corrections replace a completed message without duplicating it", () => {
  const message = { id: "message", role: "assistant" as const, parts: [{ type: "text" as const, text: "first" }] };
  const corrected = { ...message, parts: [{ type: "text" as const, text: "corrected" }] };
  expect(readLines([...messageEntries(0, message), ...messageEntries(0, corrected)])).toEqual([corrected]);
});
