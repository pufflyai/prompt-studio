/**
 * Platform-agnostic keybinding chord parser. Accepts inputs like `mod+shift+p` or
 * `cmd+enter` and produces a normalized canonical form so the dashboard can render the
 * label per-platform and dispatch through whichever hotkey backend it uses.
 *
 * The parser is strict by design: it rejects unknown modifiers, empty keys, duplicate
 * modifiers, and chords without exactly one non-modifier key — extension authors should
 * find out at extension-check time, not at runtime.
 */

const MODIFIER_ALIASES: Record<string, KeyChordModifier> = {
  alt: "alt",
  cmd: "cmd",
  command: "cmd",
  ctrl: "ctrl",
  control: "ctrl",
  meta: "cmd",
  mod: "mod",
  option: "alt",
  shift: "shift",
};

const NAMED_KEY_ALIASES: Record<string, string> = {
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  arrowup: "ArrowUp",
  backspace: "Backspace",
  delete: "Delete",
  down: "ArrowDown",
  end: "End",
  enter: "Enter",
  esc: "Escape",
  escape: "Escape",
  f1: "F1",
  f10: "F10",
  f11: "F11",
  f12: "F12",
  f2: "F2",
  f3: "F3",
  f4: "F4",
  f5: "F5",
  f6: "F6",
  f7: "F7",
  f8: "F8",
  f9: "F9",
  home: "Home",
  left: "ArrowLeft",
  pagedown: "PageDown",
  pageup: "PageUp",
  return: "Enter",
  right: "ArrowRight",
  space: "Space",
  tab: "Tab",
  up: "ArrowUp",
};

export type KeyChordModifier = "mod" | "ctrl" | "cmd" | "shift" | "alt";

/** Modifier order is normalized for stable conflict detection and label rendering. */
const MODIFIER_ORDER: KeyChordModifier[] = ["ctrl", "mod", "cmd", "alt", "shift"];

export interface KeyChord {
  modifiers: KeyChordModifier[];
  key: string;
}

export type ParseKeyChordResult = { ok: true; chord: KeyChord } | { ok: false; reason: string };

const isPrintableSingleChar = (token: string) => token.length === 1 && /^[\p{L}\p{N}\p{P}\p{S}]$/u.test(token);

const normalizeKeyToken = (token: string): string | null => {
  const lower = token.toLowerCase();
  if (NAMED_KEY_ALIASES[lower]) return NAMED_KEY_ALIASES[lower];
  if (isPrintableSingleChar(token)) return token.toUpperCase();
  return null;
};

export const parseKeyChord = (raw: string): ParseKeyChordResult => {
  if (typeof raw !== "string") return { ok: false, reason: "Keybinding must be a string" };

  const tokens = raw
    .split("+")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (tokens.length === 0) return { ok: false, reason: "Keybinding is empty" };

  const modifiers = new Set<KeyChordModifier>();
  let key: string | null = null;

  for (const token of tokens) {
    const aliased = MODIFIER_ALIASES[token.toLowerCase()];
    if (aliased) {
      if (modifiers.has(aliased)) return { ok: false, reason: `Duplicate modifier "${token}"` };
      modifiers.add(aliased);
      continue;
    }

    if (key !== null) return { ok: false, reason: `Keybinding has more than one non-modifier key` };
    const normalized = normalizeKeyToken(token);
    if (!normalized) return { ok: false, reason: `Unknown key "${token}"` };
    key = normalized;
  }

  if (key === null) return { ok: false, reason: "Keybinding is missing a non-modifier key" };

  return {
    ok: true,
    chord: {
      modifiers: MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)),
      key,
    },
  };
};

/**
 * Canonical string form of a chord — modifiers are sorted in `MODIFIER_ORDER`, so two
 * inputs like `shift+ctrl+p` and `ctrl+shift+p` produce the same id. Used as the dedup
 * key for conflict detection.
 */
export const chordCanonicalId = (chord: KeyChord) => [...chord.modifiers, chord.key].join("+");
