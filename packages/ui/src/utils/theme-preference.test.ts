import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { installMockLocalStorage } from "@/test-utils/local-storage";
import { getInitialThemePreference } from "./theme-preference";

beforeEach(() => {
  const localStorage = installMockLocalStorage();

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
      matchMedia: () => ({ matches: false }),
    },
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("getInitialThemePreference", () => {
  it("uses the pstdio light theme when the system does not prefer dark", () => {
    expect(getInitialThemePreference()).toBe("pstdio-light");
  });

  it("uses the pstdio dark theme when the system prefers dark", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: window.localStorage,
        matchMedia: () => ({ matches: true }),
      },
      configurable: true,
    });

    expect(getInitialThemePreference()).toBe("pstdio-dark");
  });

  it("restores a stored named theme preference", () => {
    window.localStorage.setItem("theme-preference", "monokai");

    expect(getInitialThemePreference()).toBe("monokai");
  });

  it("restores the dracula theme preference", () => {
    window.localStorage.setItem("theme-preference", "dracula");

    expect(getInitialThemePreference()).toBe("dracula");
  });
});
