import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { installMockLocalStorage } from "../test-utils/local-storage";
import { getInitialThemePreference, ThemePreferenceProvider, useThemePreference } from "./theme-preference";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

const installWindow = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
    },
  });
};

const ActiveTheme = () => {
  const { themePreference } = useThemePreference();
  return <span>{themePreference}</span>;
};

afterEach(() => {
  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

describe("getInitialThemePreference", () => {
  test("keeps a stored extension theme before its contribution registers", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    expect(getInitialThemePreference()).toBe("lab.monokai");
  });
});

describe("ThemePreferenceProvider", () => {
  test("uses a mode default without replacing the global preference", () => {
    installWindow();
    const storage = installMockLocalStorage();
    storage.setItem("theme-preference", "pstdio-dark");
    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider
        preferenceScope="scribble"
        defaultPreference="paper"
        themePreferences={[
          { id: "paper", mode: "light" },
          { id: "ink", mode: "dark" },
          { id: "pstdio-dark", mode: "dark" },
        ]}
      >
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );
    expect(markup).toBe("<span>paper</span>");
    expect(storage.getItem("theme-preference")).toBe("pstdio-dark");
  });

  test("restores an explicit mode preference before its declared default", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference:scribble", "ink");
    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider
        preferenceScope="scribble"
        defaultPreference="paper"
        themePreferences={[
          { id: "paper", mode: "light" },
          { id: "ink", mode: "dark" },
        ]}
      >
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );
    expect(markup).toBe("<span>ink</span>");
  });

  test("renders the default theme while waiting for a stored extension theme to register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <ActiveTheme />
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>pstdio-light</span>");
  });

  test("renders after the stored extension theme registers", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider themePreferences={[{ id: "lab.monokai", mode: "dark" }]}>
        <span>Workbench</span>
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>Workbench</span>");
  });

  test("renders despite a legacy stored preference that will never register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "light");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <span>Workbench</span>
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("<span>Workbench</span>");
  });
});

describe("ThemePreferenceProvider with host storage", () => {
  test("reads and saves the theme through the supplied storage", async () => {
    const { act, create } = await import("react-test-renderer");
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installWindow();
    const browserStorage = installMockLocalStorage();
    const values = new Map([["theme-preference:scribble", "ink"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    let context: ReturnType<typeof useThemePreference> | undefined;
    const CaptureTheme = () => {
      context = useThemePreference();
      return null;
    };

    await act(async () => {
      create(
        <ThemePreferenceProvider
          storage={storage}
          preferenceScope="scribble"
          themePreferences={[
            { id: "paper", mode: "light" },
            { id: "ink", mode: "dark" },
          ]}
        >
          <CaptureTheme />
        </ThemePreferenceProvider>,
      );
    });
    expect(context?.themePreference).toBe("ink");

    await act(async () => context?.setThemePreference("paper"));

    expect(context?.themePreference).toBe("paper");
    expect(values.get("theme-preference:scribble")).toBe("paper");
    expect(browserStorage.length).toBe(0);
  });
});

describe("ThemePreferenceProvider pending theme", () => {
  test("names the chosen theme while it waits for its extension to register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");
    const PendingTheme = () => {
      const { pendingThemePreference, themePreference } = useThemePreference();
      return <span>{`${themePreference}:${pendingThemePreference}`}</span>;
    };

    const waiting = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <PendingTheme />
      </ThemePreferenceProvider>,
    );
    const registered = renderToStaticMarkup(
      <ThemePreferenceProvider themePreferences={[{ id: "lab.monokai", mode: "dark" }]}>
        <PendingTheme />
      </ThemePreferenceProvider>,
    );

    expect(waiting).toBe("<span>pstdio-light:lab.monokai</span>");
    expect(registered).toBe("<span>lab.monokai:null</span>");
  });
});
