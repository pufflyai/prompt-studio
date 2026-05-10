import { describe, expect, test } from "bun:test";
import { applyThemePreference, type ThemePreferenceOption } from "./apply-theme-preference";

const createFakeElement = () => {
  const attributes = new Map<string, string>();
  const styleValues = new Map<string, string>();
  const classes = new Set<string>();

  return {
    classList: {
      add: (...names: string[]) => {
        for (const name of names) classes.add(name);
      },
      remove: (...names: string[]) => {
        for (const name of names) classes.delete(name);
      },
    },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {
      colorScheme: "",
      getPropertyValue: (name: string) => styleValues.get(name) ?? "",
      removeProperty: (name: string) => styleValues.delete(name),
      setProperty: (name: string, value: string) => styleValues.set(name, value),
    },
  };
};

describe("applyThemePreference", () => {
  test("removes custom token variables when a previous theme disappears from preferences", () => {
    const root = createFakeElement();
    const body = createFakeElement();
    const previousDocument = globalThis.document;
    globalThis.document = { documentElement: root, body } as never;

    const extensionTheme = {
      id: "lab.monokai",
      mode: "dark",
      tokens: { "colors.bg": "#272822" },
    } satisfies ThemePreferenceOption;

    try {
      applyThemePreference("lab.monokai", [extensionTheme]);
      expect(root.style.getPropertyValue("--chakra-colors-bg")).toBe("#272822");

      applyThemePreference("pstdio-light");

      expect(root.style.getPropertyValue("--chakra-colors-bg")).toBe("");
      expect(body.style.getPropertyValue("--chakra-colors-bg")).toBe("");
    } finally {
      globalThis.document = previousDocument;
    }
  });
});
