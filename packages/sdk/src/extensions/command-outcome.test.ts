import { describe, expect, test } from "bun:test";
import { unwrapCommandOutcome } from "./command-outcome";

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
