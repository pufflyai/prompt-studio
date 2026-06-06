import { describe, expect, test } from "bun:test";
import { deriveTitle } from "./derive-title";

describe("deriveTitle", () => {
  test("uses the first non-empty line, stripping markdown heading markers", () => {
    expect(deriveTitle("# Fix the login bug\n\nbody text")).toBe("Fix the login bug");
    expect(deriveTitle("### Nested heading")).toBe("Nested heading");
  });

  test("skips leading blank lines", () => {
    expect(deriveTitle("\n\n   \nFirst real line\nsecond")).toBe("First real line");
  });

  test("falls back to Untitled for empty or whitespace-only content", () => {
    expect(deriveTitle("")).toBe("Untitled");
    expect(deriveTitle("   \n\t\n")).toBe("Untitled");
  });
});
