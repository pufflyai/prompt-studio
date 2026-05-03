import { describe, expect, test } from "bun:test";
import {
  buildOpenCommandPaletteMessage,
  buildSetThemePreferenceMessage,
  getThemePreferenceFromSearch,
  readHostThemeMessage,
  shouldForwardCommandPaletteShortcut,
} from "./host-bridge";

describe("tickets host bridge", () => {
  test("reads the initial host theme from the webview route query", () => {
    expect(getThemePreferenceFromSearch("?themePreference=pstdio-dark")).toBe("pstdio-dark");
    expect(getThemePreferenceFromSearch("")).toBe("");
  });

  test("reads host theme update messages", () => {
    expect(readHostThemeMessage({ type: "pstdio.host.themePreference", themePreference: "pstdio-light" })).toBe(
      "pstdio-light",
    );
    expect(readHostThemeMessage({ type: "pstdio.host.themePreference" })).toBeNull();
    expect(readHostThemeMessage(null)).toBeNull();
  });

  test("builds messages sent from the tickets webview to the host", () => {
    expect(buildOpenCommandPaletteMessage()).toEqual({ type: "pstdio.extension.openCommandPalette" });
    expect(buildSetThemePreferenceMessage("pstdio-dark")).toEqual({
      type: "pstdio.extension.setThemePreference",
      themePreference: "pstdio-dark",
    });
  });

  test("forwards the command palette shortcut to the host", () => {
    expect(shouldForwardCommandPaletteShortcut({ key: "P", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(shouldForwardCommandPaletteShortcut({ key: "p", metaKey: true, shiftKey: true })).toBe(true);
    expect(shouldForwardCommandPaletteShortcut({ key: "P", ctrlKey: true, shiftKey: false })).toBe(false);
  });
});
