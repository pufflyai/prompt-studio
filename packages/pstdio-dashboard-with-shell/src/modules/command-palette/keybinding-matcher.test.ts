import { describe, expect, it } from "bun:test";
import { matchesKeybinding, parseKeybinding } from "./keybinding-matcher";

const event = (input: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    key: "",
    ...input,
  }) as KeyboardEvent;

describe("parseKeybinding", () => {
  it("parses a single key", () => {
    expect(parseKeybinding("P")).toEqual({ ctrl: false, shift: false, alt: false, meta: false, key: "p" });
  });

  it("parses modifiers and key in any order", () => {
    expect(parseKeybinding("Ctrl+Shift+P")).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: "p" });
    expect(parseKeybinding("Shift+Ctrl+P")).toEqual({ ctrl: true, shift: true, alt: false, meta: false, key: "p" });
  });

  it("returns null when no key is present", () => {
    expect(parseKeybinding("Ctrl+Shift")).toBeNull();
  });

  it("returns null when more than one non-modifier token is given", () => {
    expect(parseKeybinding("Ctrl+P+Q")).toBeNull();
  });
});

describe("matchesKeybinding", () => {
  it("matches Ctrl+Shift+P against the corresponding event", () => {
    expect(matchesKeybinding("Ctrl+Shift+P", event({ ctrlKey: true, shiftKey: true, key: "P" }))).toBe(true);
  });

  it("rejects events missing required modifiers", () => {
    expect(matchesKeybinding("Ctrl+Shift+P", event({ ctrlKey: true, key: "p" }))).toBe(false);
  });

  it("rejects events with extra modifiers", () => {
    expect(matchesKeybinding("Ctrl+Shift+P", event({ ctrlKey: true, shiftKey: true, metaKey: true, key: "p" }))).toBe(
      false,
    );
  });

  it("rejects keys that do not match", () => {
    expect(matchesKeybinding("Ctrl+Shift+P", event({ ctrlKey: true, shiftKey: true, key: "k" }))).toBe(false);
  });
});
