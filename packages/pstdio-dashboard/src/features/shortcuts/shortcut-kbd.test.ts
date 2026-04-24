import { describe, expect, it } from "bun:test";
import { getShortcutDisplayTokens, getShortcutPlatform } from "./shortcut-kbd";

describe("shortcut-kbd", () => {
  it("shows mac labels for modifier keys", () => {
    expect(getShortcutDisplayTokens("Mod+K", "mac")).toEqual([["Cmd", "K"]]);
  });

  it("shows windows labels for modifier keys", () => {
    expect(getShortcutDisplayTokens("Mod+K", "windows")).toEqual([["Ctrl", "K"]]);
  });

  it("shows modifier labels for the shortcut help binding", () => {
    expect(getShortcutDisplayTokens("Mod+Shift+H", "mac")).toEqual([["Cmd", "Shift", "H"]]);
  });

  it("falls back to windows labels for unknown platforms", () => {
    expect(getShortcutPlatform("Linux x86_64")).toBe("windows");
  });
});
