import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { installMockLocalStorage } from "../test-utils/local-storage";
import { getInitialThemePreference, ThemePreferenceProvider } from "./theme-preference";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

const installWindow = () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false }),
    },
  });
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
  test("does not render while waiting for a stored extension theme to register", () => {
    installWindow();
    installMockLocalStorage().setItem("theme-preference", "lab.monokai");

    const markup = renderToStaticMarkup(
      <ThemePreferenceProvider>
        <span>Workbench</span>
      </ThemePreferenceProvider>,
    );

    expect(markup).toBe("");
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
