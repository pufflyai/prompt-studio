import { describe, expect, test } from "bun:test";
import {
  buildHostCommandOutcomeToastMessages,
  buildOpenCommandPaletteMessage,
  buildSetThemePreferenceMessage,
  getThemePreferenceFromSearch,
  readHostThemeMessage,
  shouldForwardCommandPaletteShortcut,
} from "./host-bridge";

describe("lab host bridge", () => {
  test("reads the initial host theme from the webview route query", () => {
    expect(getThemePreferenceFromSearch("?themePreference=pstdio-dark")).toBe("pstdio-dark");
  });

  test("reads host theme update messages", () => {
    expect(readHostThemeMessage({ type: "pstdio.host.themePreference", themePreference: "pstdio-light" })).toBe(
      "pstdio-light",
    );
    expect(readHostThemeMessage({ type: "pstdio.host.themePreference" })).toBeNull();
  });

  test("builds messages sent from the lab webview to the host", () => {
    expect(buildOpenCommandPaletteMessage()).toEqual({ type: "pstdio.extension.openCommandPalette" });
    expect(buildSetThemePreferenceMessage("pstdio-dark")).toEqual({
      type: "pstdio.extension.setThemePreference",
      themePreference: "pstdio-dark",
    });
    expect(
      buildHostCommandOutcomeToastMessages("Lab: Say hello", {
        status: "success",
        notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
      }),
    ).toEqual([
      {
        type: "pstdio.extension.showToast",
        toast: { type: "info", title: "Lab", description: "Hello from the lab" },
      },
    ]);
  });

  test("forwards the command palette shortcut to the host", () => {
    expect(shouldForwardCommandPaletteShortcut({ key: "P", ctrlKey: true, shiftKey: true })).toBe(true);
    expect(shouldForwardCommandPaletteShortcut({ key: "p", metaKey: true, shiftKey: true })).toBe(true);
    expect(shouldForwardCommandPaletteShortcut({ key: "P", ctrlKey: true, shiftKey: false })).toBe(false);
  });
});
