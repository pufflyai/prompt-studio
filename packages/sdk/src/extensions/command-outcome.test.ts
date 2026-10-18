import { describe, expect, test } from "bun:test";
import type { CommandOutcome } from "pstdio-api-contracts/extension-kernel";
import { CommandOutcomeError, getCommandValue, unwrapCommandOutcome } from "./command-outcome";

test("command value errors retain the complete rejected outcome", () => {
  const outcome = {
    ok: false,
    status: "rejected",
    code: "stale_revision",
    reason: "Changed",
    data: { revision: 2 },
    cause: { source: "storage" },
    diagnostics: [{ code: "conflict", message: "Changed", severity: "warning" }],
    notices: [{ type: "warning", message: "Reload" }],
  } satisfies CommandOutcome;
  expect(getCommandValue({ ok: true, status: "success", value: 42 })).toBe(42);
  try {
    getCommandValue(outcome);
    throw new Error("Expected a rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(CommandOutcomeError);
    expect(error).toMatchObject({ code: "stale_revision", outcome });
  }
});

test("command value errors keep a serialized failure message when the reason is empty", () => {
  const outcome = { ok: false, status: "error", reason: "", error: { message: "Create failed" } } as const;
  expect(() => getCommandValue(outcome)).toThrow("Create failed");
});

describe("unwrapCommandOutcome", () => {
  test("returns the command value on success", () => {
    expect(unwrapCommandOutcome({ outcome: { ok: true, status: "success", value: "done" } })).toBe("done");
  });

  test("throws the command reason on rejected outcomes", () => {
    expect(() => unwrapCommandOutcome({ outcome: { ok: false, status: "rejected", reason: "missing input" } })).toThrow(
      "missing input",
    );
  });

  test("uses a fallback reason when an error outcome has no reason", () => {
    expect(() =>
      unwrapCommandOutcome({
        outcome: { ok: false, status: "error", reason: "" },
      }),
    ).toThrow("Command failed.");
  });
});
