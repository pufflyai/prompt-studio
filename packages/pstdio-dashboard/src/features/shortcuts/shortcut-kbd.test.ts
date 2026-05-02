import { describe, expect, it } from "bun:test";
import { getShortcutDisplayParts, getShortcutDisplayTokens } from "./shortcut-kbd";

describe("shortcut-kbd", () => {
  it("splits a single-step shortcut into tokens", () => {
    expect(getShortcutDisplayTokens("Ctrl+K")).toEqual([["Ctrl", "K"]]);
  });

  it("renders all modifier tokens for the shortcut help binding", () => {
    expect(getShortcutDisplayTokens("Ctrl+Shift+H")).toEqual([["Ctrl", "Shift", "H"]]);
  });

  it("returns plain label parts without icon overrides", () => {
    expect(getShortcutDisplayParts("Ctrl+P")).toEqual([[{ label: "Ctrl" }, { label: "P" }]]);
  });
});
