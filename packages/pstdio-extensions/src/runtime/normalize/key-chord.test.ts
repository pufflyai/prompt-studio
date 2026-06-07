import { describe, expect, test } from "bun:test";
import { chordCanonicalId, parseKeyChord } from "./key-chord";

describe("parseKeyChord", () => {
  test("parses mod+shift+p", () => {
    const result = parseKeyChord("mod+shift+p");
    expect(result).toEqual({ ok: true, chord: { modifiers: ["mod", "shift"], key: "P" } });
  });

  test("aliases cmd, command, meta to cmd; ctrl/control to ctrl; alt/option to alt", () => {
    expect(parseKeyChord("cmd+k")).toEqual({ ok: true, chord: { modifiers: ["cmd"], key: "K" } });
    expect(parseKeyChord("command+k")).toEqual({ ok: true, chord: { modifiers: ["cmd"], key: "K" } });
    expect(parseKeyChord("meta+k")).toEqual({ ok: true, chord: { modifiers: ["cmd"], key: "K" } });
    expect(parseKeyChord("control+k")).toEqual({ ok: true, chord: { modifiers: ["ctrl"], key: "K" } });
    expect(parseKeyChord("option+k")).toEqual({ ok: true, chord: { modifiers: ["alt"], key: "K" } });
  });

  test("normalizes named keys and arrows", () => {
    expect(parseKeyChord("ctrl+enter")).toEqual({ ok: true, chord: { modifiers: ["ctrl"], key: "Enter" } });
    expect(parseKeyChord("shift+ArrowUp")).toEqual({ ok: true, chord: { modifiers: ["shift"], key: "ArrowUp" } });
    expect(parseKeyChord("esc")).toEqual({ ok: true, chord: { modifiers: [], key: "Escape" } });
    expect(parseKeyChord("space")).toEqual({ ok: true, chord: { modifiers: [], key: "Space" } });
  });

  test("sorts modifiers in stable order so equivalent inputs collide", () => {
    const a = parseKeyChord("shift+ctrl+p");
    const b = parseKeyChord("ctrl+shift+p");
    expect(a.ok && b.ok && chordCanonicalId(a.chord) === chordCanonicalId(b.chord)).toBe(true);
  });

  test("rejects empty, modifier-only, and multi-key chords", () => {
    expect(parseKeyChord("").ok).toBe(false);
    expect(parseKeyChord("shift").ok).toBe(false);
    expect(parseKeyChord("ctrl+a+b").ok).toBe(false);
  });

  test("rejects unknown modifiers and duplicates", () => {
    expect(parseKeyChord("hyper+a").ok).toBe(false);
    expect(parseKeyChord("shift+shift+a").ok).toBe(false);
  });
});
