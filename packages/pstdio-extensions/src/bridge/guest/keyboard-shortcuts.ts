import type { WebviewKeyboardShortcut, WebviewKeyboardShortcutRequest } from "pstdio-api-contracts/extension-kernel";

const normalizeKey = (key: string) => (key === " " ? "SPACE" : key.toUpperCase());

export const matchesKeyboardShortcut = (event: KeyboardEvent, shortcut: WebviewKeyboardShortcut) =>
  !(event.isComposing || event.getModifierState?.("AltGraph")) &&
  (normalizeKey(event.key) === normalizeKey(shortcut.key) ||
    (/^[0-9]$/.test(shortcut.key) && event.code === `Digit${shortcut.key}`)) &&
  event.ctrlKey === Boolean(shortcut.ctrlKey) &&
  event.metaKey === Boolean(shortcut.metaKey) &&
  event.altKey === Boolean(shortcut.altKey) &&
  event.shiftKey === Boolean(shortcut.shiftKey);

/** Only negotiated host chords cross this boundary. Ordinary guest keys stay local. */
export const installKeyboardShortcuts = (
  target: EventTarget,
  shortcuts: () => readonly WebviewKeyboardShortcut[],
  dispatch: (request: WebviewKeyboardShortcutRequest) => void,
) => {
  const listener = (input: Event) => {
    const event = input as KeyboardEvent;
    const shortcut = shortcuts().find((candidate) => matchesKeyboardShortcut(event, candidate));
    if (!shortcut) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatch({ id: shortcut.id, repeat: event.repeat });
  };
  target.addEventListener("keydown", listener, true);
  return () => target.removeEventListener("keydown", listener, true);
};
