import type { WebviewKeyboardShortcut, WebviewKeyboardShortcutRequest } from "pstdio-api-contracts/extension-kernel";

const normalizeKey = (key: string) => (key === " " ? "SPACE" : key.toUpperCase());

export const isEditableKeyboardEvent = (event: KeyboardEvent) =>
  typeof Element !== "undefined" &&
  event
    .composedPath()
    .some(
      (target) =>
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
        ),
    );

// Option can replace a letter with a symbol or dead key. Keep ordinary layout letters intact.
const shortcutEventKey = (event: KeyboardEvent) =>
  event.altKey && !/^[a-z]$/i.test(event.key) && /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : event.key;

export const matchesKeyboardShortcut = (event: KeyboardEvent, shortcut: WebviewKeyboardShortcut) =>
  !(event.isComposing || event.getModifierState?.("AltGraph")) &&
  (normalizeKey(shortcutEventKey(event)) === normalizeKey(shortcut.key) ||
    (normalizeKey(shortcut.key) === "SPACE" && event.code === "Space") ||
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
    const editable = isEditableKeyboardEvent(event);
    // Global chords hold a modifier; plain editor chords remain available outside text fields.
    if (editable && !event.altKey && !event.ctrlKey && !event.metaKey) return;
    const shortcut = shortcuts().find(
      (candidate) => (!editable || candidate.allowInInputs !== false) && matchesKeyboardShortcut(event, candidate),
    );
    if (!shortcut) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatch({ id: shortcut.id, repeat: event.repeat });
  };
  target.addEventListener("keydown", listener, true);
  return () => target.removeEventListener("keydown", listener, true);
};
