/**
 * Keyboard chord rules shared by extension checks and the workbench host.
 *
 * `@tanstack/hotkeys` 0.30 matches named keys only in their canonical spelling, such as `ArrowLeft`.
 * Earlier versions also accepted aliases and other cases (`esc`, `Up`, `arrowleft`, `f2`).
 */
const NAMED_KEYS = new Map<string, string>([
  ...[
    "Escape",
    "Enter",
    "Space",
    "Tab",
    "Backspace",
    "Delete",
    "Insert",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`),
  ].map((key): [string, string] => [key.toLowerCase(), key]),
  ["esc", "Escape"],
  ["return", "Enter"],
  ["spacebar", "Space"],
  ["del", "Delete"],
  ["up", "ArrowUp"],
  ["down", "ArrowDown"],
  ["left", "ArrowLeft"],
  ["right", "ArrowRight"],
  ["pgup", "PageUp"],
  ["pgdn", "PageDown"],
]);

/** Spells every named key in a chord or space-separated sequence the way the matcher expects. */
export const withNamedKeyCase = (chord: string) =>
  chord
    .split(/(\s+|\+)/)
    .map((part) => NAMED_KEYS.get(part.toLowerCase()) ?? part)
    .join("");

// Physical keys that produce text on common layouts.
const TEXT_CODES =
  /^(Key[A-Z]|Digit[0-9]|Numpad([0-9]|Add|Subtract|Multiply|Divide|Decimal)|Space|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen)$/;

/**
 * Whether a parsed chord types text: a printable key or Space, alone or with only Shift. Such keys
 * belong to whatever has focus, so they never work as direct shortcuts.
 */
export const typesText = (chord: { key?: string; code?: string; ctrl: boolean; alt: boolean; meta: boolean }) => {
  if (chord.ctrl || chord.alt || chord.meta) return false;
  if (chord.key !== undefined) return chord.key.length === 1 || chord.key === "Space";
  return TEXT_CODES.test(chord.code ?? "");
};
