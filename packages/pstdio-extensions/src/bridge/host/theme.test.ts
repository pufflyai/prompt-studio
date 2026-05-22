import { describe, expect, test } from "bun:test";
import { resolveActiveTheme } from "./theme";

const withDocumentElement = (attributes: Record<string, string>, run: () => void) => {
  const previousDocument = globalThis.document;

  globalThis.document = {
    documentElement: {
      getAttribute: (name: string) => attributes[name] ?? null,
    },
  } as never;

  try {
    run();
  } finally {
    globalThis.document = previousDocument;
  }
};

describe("resolveActiveTheme", () => {
  test("uses Chakra color mode when data-theme stores a preference id", () => {
    withDocumentElement({ "data-theme": "pstdio-dark", "data-color-mode": "dark" }, () => {
      expect(resolveActiveTheme("light")).toBe("dark");
    });
  });

  test("keeps direct light and dark theme values working", () => {
    withDocumentElement({ "data-theme": "dark", "data-color-mode": "light" }, () => {
      expect(resolveActiveTheme("light")).toBe("dark");
    });
  });
});
