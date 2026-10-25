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

const applyTheme = (theme: ThemePreferenceOption) => {
  const root = createFakeElement();
  const body = createFakeElement();
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: root, body } as never;

  try {
    applyThemePreference(theme.id, [theme]);
    return root;
  } finally {
    globalThis.document = previousDocument;
  }
};

describe("applyThemePreference", () => {
  test("mixes the pressed color from the theme surface when the theme leaves it out", () => {
    const root = applyTheme({
      id: "lab.kiln",
      mode: "dark",
      tokens: { "colors.bg": "#25272b", "colors.fg": "#e7e9ec" },
    });

    expect(root.style.getPropertyValue("--chakra-colors-bg-active")).toMatch(
      /^color-mix\(in srgb, var\(--chakra-colors-fg\) \d+%, var\(--chakra-colors-bg\)\)$/,
    );
  });

  test("keeps the pressed color a theme defines", () => {
    const root = applyTheme({
      id: "lab.dracula",
      mode: "dark",
      tokens: { "colors.bg": "#282a36", "colors.bg.active": "#565a6d" },
    });

    expect(root.style.getPropertyValue("--chakra-colors-bg-active")).toBe("#565a6d");
  });

  test("keeps the default pressed color for a theme that keeps the default surface", () => {
    const root = applyTheme({ id: "lab.accent", mode: "light", tokens: { "colors.border.accent": "#66d9ef" } });

    expect(root.style.getPropertyValue("--chakra-colors-bg-active")).toBe("");
  });

  test("removes the mixed pressed color when the theme changes", () => {
    const root = createFakeElement();
    const body = createFakeElement();
    const previousDocument = globalThis.document;
    globalThis.document = { documentElement: root, body } as never;

    try {
      applyThemePreference("lab.kiln", [{ id: "lab.kiln", mode: "dark", tokens: { "colors.bg": "#25272b" } }]);
      applyThemePreference("pstdio-light");

      expect(root.style.getPropertyValue("--chakra-colors-bg-active")).toBe("");
      expect(body.style.getPropertyValue("--chakra-colors-bg-active")).toBe("");
    } finally {
      globalThis.document = previousDocument;
    }
  });

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
