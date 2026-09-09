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

describe("deriveShorthand produces a usable resource prefix", () => {
  test("falls back when the name has no letters", () => {
    expect(deriveShorthand("2026")).toBe("PRJ");
    expect(deriveShorthand("...")).toBe("PRJ");
  });

  test("avoids the prefix reserved for workspaces", () => {
    expect(deriveShorthand("Work Space")).toBe("WOS");
    expect(deriveShorthand("web server")).toBe("WES");
  });

  test("clamps a long name to the maximum prefix length", () => {
    expect(deriveShorthand("a b c d e f g h i j k l m n o p q r s")).toBe("ABCDEFGHIJKLMNOP");
  });
});
