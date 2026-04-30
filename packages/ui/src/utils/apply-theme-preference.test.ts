import { describe, expect, it } from "bun:test";
import {
  getThemePreferenceClassNames,
  getThemePreferenceMode,
  isThemePreference,
  themePreferences,
} from "./apply-theme-preference";
import { themePreferenceCssVariables } from "./theme-preference-palettes";

describe("theme preferences", () => {
  it("treats pstdio light and dark as named themes", () => {
    expect(themePreferences).toEqual(["pstdio-light", "pstdio-dark", "monokai", "dracula"]);
    expect(isThemePreference("pstdio-light")).toBe(true);
    expect(isThemePreference("pstdio-dark")).toBe(true);
    expect(getThemePreferenceMode("pstdio-light")).toBe("light");
    expect(getThemePreferenceMode("pstdio-dark")).toBe("dark");
    expect(getThemePreferenceClassNames("pstdio-light")).toEqual(["light", "theme-pstdio-light"]);
    expect(getThemePreferenceClassNames("pstdio-dark")).toEqual(["dark", "theme-pstdio-dark"]);
  });

  it("treats monokai as a named dark theme", () => {
    expect(themePreferences).toContain("monokai");
    expect(isThemePreference("monokai")).toBe(true);
    expect(getThemePreferenceMode("monokai")).toBe("dark");
    expect(getThemePreferenceClassNames("monokai")).toEqual(["dark", "theme-monokai"]);
  });

  it("treats dracula as a named dark custom theme", () => {
    expect(themePreferences).toContain("dracula");
    expect(isThemePreference("dracula")).toBe(true);
    expect(getThemePreferenceMode("dracula")).toBe("dark");
    expect(getThemePreferenceClassNames("dracula")).toEqual(["dark", "theme-dracula"]);
    expect(themePreferenceCssVariables.dracula["--chakra-colors-bg"]).toBe("#282A36");
  });
});
