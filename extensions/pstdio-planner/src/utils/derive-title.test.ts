import { describe, expect, test } from "bun:test";
import { deriveTitle } from "./derive-title";

describe("deriveTitle", () => {
  test("uses the first non-empty line, stripping markdown heading markers", () => {
    expect(deriveTitle("# Fix the login bug\n\nbody text")).toBe("Fix the login bug");
    expect(deriveTitle("### Nested heading")).toBe("Nested heading");
  });

  test("strips markdown and inline html formatting from the title", () => {
    expect(deriveTitle("## **Fix** <ins>login</ins> `bug`")).toBe("Fix login bug");
    expect(deriveTitle("> - [Fix the **login** bug](https://example.com)")).toBe("Fix the login bug");
  });

  test("keeps literal markdown punctuation when it is visible title text", () => {
    expect(deriveTitle("#123 Fix auth_token parsing")).toBe("#123 Fix auth_token parsing");
  });

  test("skips leading fenced code blocks", () => {
    expect(deriveTitle("```javascript\nconst value = true;\n```\n# Fix the login bug")).toBe("Fix the login bug");
  });

  test("skips leading blank lines", () => {
    expect(deriveTitle("\n\n   \nFirst real line\nsecond")).toBe("First real line");
  });

  test("falls back to Untitled for empty or whitespace-only content", () => {
    expect(deriveTitle("")).toBe("Untitled");
    expect(deriveTitle("   \n\t\n")).toBe("Untitled");
  });
});
