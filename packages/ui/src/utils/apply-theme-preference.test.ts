import { describe, expect, it } from "bun:test";
import {
  getThemePreferenceClassNames,
  getThemePreferenceMode,
  isThemePreference,
  themePreferences,
} from "./apply-theme-preference";

describe("theme preferences", () => {
  it("treats pstdio light and dark as named themes", () => {
    expect(themePreferences).toEqual(["pstdio-light", "pstdio-dark", "monokai"]);
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
});
