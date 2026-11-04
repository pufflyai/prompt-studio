import { expect, test } from "bun:test";
import { projectToolResultRecovery } from "./result-recovery";
import type { SessionMessage } from "./session-messages";
import { normalizeMessageResults, normalizeToolResult, toolOutputFingerprint } from "./tool-result";

const message = (output: unknown): SessionMessage => ({
  id: "tool",
  role: "assistant",
  parts: [{ type: "tool", tool: "Bash", callId: "call", status: "completed", state: { output } }],
});

test("legacy and shortened results share a comparison view, retaining a saved summary across allowance changes", () => {
  const raw = message({ returnDisplay: `HEAD${"x".repeat(1000000)}TAIL`, duplicated: "x".repeat(1000000) });
  const known = normalizeMessageResults(raw);
  const native = message((raw.parts[0] as { state: { output: { returnDisplay: string } } }).state.output.returnDisplay);
  const projected = projectToolResultRecovery(
    [known],
    [native, { id: "later", role: "assistant", parts: [{ type: "text", text: "later reply" }] }],
  );
  expect(projected.nativeMessages[0].parts).toEqual(projected.knownMessages[0].parts);
  expect(projected.nativeMessages[1].id).toBe("later");
  expect(projectToolResultRecovery(projected.knownMessages, projected.nativeMessages)).toEqual(projected);
});

test("different original results with identical visible ends are never projected onto one summary", () => {
  const a = message(`${"HEAD".repeat(100000)}x${"TAIL".repeat(100000)}`);
  const b = message(`${"HEAD".repeat(100000)}y${"TAIL".repeat(100000)}`);
  const projected = projectToolResultRecovery([a], [b]);
  const left = projected.knownMessages[0].parts[0];
  const right = projected.nativeMessages[0].parts[0];
  if (left.type !== "tool" || right.type !== "tool") throw new Error("Expected tools");
  expect(left.state?.output).toEqual(right.state?.output);
  expect(projected.knownMessages[0].parts).not.toEqual(projected.nativeMessages[0].parts);
});

test("a saved smaller summary survives when the current allowance could retain the full native result", () => {
  const native = message("x".repeat(100000));
  const part = native.parts[0];
  if (part.type !== "tool") throw new Error("Expected tool");
  const known = { ...native, parts: [normalizeToolResult(part, 65536)] };
  const projected = projectToolResultRecovery([known], [native]);
  expect(projected.knownMessages[0].parts).toEqual(known.parts);
  expect(projected.nativeMessages[0].parts).toEqual(known.parts);
});

test("error-only results with different original failures retain distinct identities", () => {
  const a = message(undefined);
  const b = message(undefined);
  if (a.parts[0].type !== "tool" || b.parts[0].type !== "tool") throw new Error("Expected tools");
  a.parts[0].state = { errorText: "x".repeat(1000000) };
  b.parts[0].state = { errorText: "y".repeat(1000000) };
  const projected = projectToolResultRecovery([a], [b]);
  expect(projected.knownMessages[0].parts).not.toEqual(projected.nativeMessages[0].parts);
});

test("the same defined output does not hide different oversized error details", () => {
  const a = message("");
  const b = message("");
  if (a.parts[0].type !== "tool" || b.parts[0].type !== "tool") throw new Error("Expected tools");
  const prefix = "HEAD".repeat(100000);
  const suffix = "TAIL".repeat(100000);
  a.parts[0].state = { output: "", errorText: `${prefix}x${suffix}` };
  b.parts[0].state = { output: "", errorText: `${prefix}y${suffix}` };
  const projected = projectToolResultRecovery([a], [b]);
  expect(projected.knownMessages[0].parts).not.toEqual(projected.nativeMessages[0].parts);
});

test("separate returned metadata participates in original recovery identity", () => {
  const a = message("");
  const b = message("");
  if (a.parts[0].type !== "tool" || b.parts[0].type !== "tool") throw new Error("Expected tools");
  a.parts[0].state = { output: "", metadata: { details: `${"HEAD".repeat(100000)}x${"TAIL".repeat(100000)}` } };
  b.parts[0].state = { output: "", metadata: { details: `${"HEAD".repeat(100000)}y${"TAIL".repeat(100000)}` } };
  const projected = projectToolResultRecovery([a], [b]);
  expect(projected.knownMessages[0].parts).not.toEqual(projected.nativeMessages[0].parts);
});

test("metadata attached after shortening preserves the native result identity", () => {
  const raw = { type: "tool" as const, tool: "shell", state: { errorText: "x".repeat(1000000) } };
  const saved = normalizeToolResult(raw);
  const updated = normalizeToolResult({ ...saved, state: { ...saved.state, metadata: { exitCode: 1 } } });
  const native = normalizeToolResult({ ...raw, state: { ...raw.state, metadata: { exitCode: 1 } } });
  expect(toolOutputFingerprint(updated)).toBe(toolOutputFingerprint(native));
});
