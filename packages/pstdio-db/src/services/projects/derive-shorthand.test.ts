import { describe, expect, test } from "bun:test";
import { deriveShorthand } from "./derive-shorthand";

describe("deriveShorthand", () => {
  test("hyphen-separated words", () => {
    expect(deriveShorthand("prompt-studio")).toBe("PS");
  });

  test("space-separated words", () => {
    expect(deriveShorthand("my app")).toBe("MA");
  });

  test("single word", () => {
    expect(deriveShorthand("backend")).toBe("B");
  });

  test("underscore-separated words", () => {
    expect(deriveShorthand("cool_side_project")).toBe("CSP");
  });

  test("mixed separators", () => {
    expect(deriveShorthand("my-cool app_thing")).toBe("MCAT");
  });

  test("extra whitespace is ignored", () => {
    expect(deriveShorthand("  my   app  ")).toBe("MA");
  });

  test("already uppercase input", () => {
    expect(deriveShorthand("MY-APP")).toBe("MA");
  });

  test("strips non-letter characters", () => {
    expect(deriveShorthand("my (cool) project")).toBe("MCP");
  });

  test("words made entirely of non-letter characters are excluded", () => {
    expect(deriveShorthand("app --- 123 test")).toBe("AT");
  });

  test("leading special characters in words are ignored", () => {
    expect(deriveShorthand("#my-@app")).toBe("MA");
  });
});
