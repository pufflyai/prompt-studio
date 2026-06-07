import { describe, expect, test } from "bun:test";
import { chordContextKey, validateKeybindingContribution } from "./validate-keybinding";

const baseCtx = (overrides: Partial<Parameters<typeof validateKeybindingContribution>[1]> = {}) => ({
  keybindingId: "lab.do-it",
  resolveCommandId: (value: unknown) => (typeof value === "string" ? value : null),
  hasCommand: (id: string) => id === "lab.run",
  ...overrides,
});

describe("validateKeybindingContribution", () => {
  test("returns a canonical record for a valid contribution", () => {
    const result = validateKeybindingContribution({ key: "mod+shift+h", command: "lab.run" }, baseCtx());
    expect(result).toEqual({
      ok: true,
      commandId: "lab.run",
      value: {
        key: "mod+shift+h",
        chord: { modifiers: ["mod", "shift"], key: "H" },
        chordId: "mod+shift+H",
        mac: undefined,
        linux: undefined,
        win: undefined,
        when: undefined,
        args: undefined,
      },
    });
  });

  test("rejects non-string key", () => {
    const result = validateKeybindingContribution({ key: 5, command: "lab.run" }, baseCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.code).toBe("invalid_keybinding");
  });

  test("rejects invalid platform overrides — keeping the API check in sync with the runtime", () => {
    const result = validateKeybindingContribution({ key: "mod+p", mac: "hyper+x", command: "lab.run" }, baseCtx());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("invalid_keybinding");
      expect(result.failure.message).toContain("mac key");
    }
  });

  test("rejects unknown commands with the unresolved id attached", () => {
    const result = validateKeybindingContribution({ key: "mod+p", command: "lab.missing" }, baseCtx());
    expect(result.ok).toBe(false);
    if (!result.ok && result.failure.code === "unknown_keybinding_command") {
      expect(result.failure.commandId).toBe("lab.missing");
    }
  });
});

describe("chordContextKey", () => {
  test("treats two bindings with different when as distinct chords", () => {
    expect(chordContextKey("mod+P")).not.toBe(chordContextKey("mod+P", { mode: "workspace" }));
    expect(chordContextKey("mod+P", { mode: "workspace" })).toBe(chordContextKey("mod+P", { mode: "workspace" }));
  });
});
