import type { WebviewKeyboardShortcut } from "pstdio-api-contracts/extension-kernel";

export const isEditableKeyboardTarget = (target: EventTarget | null) =>
  Boolean(
    (target as Element | null)?.closest?.(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="textbox"]',
    ),
  );

/** Dialogs and menus keep ownership of their keys before a host shortcut may enter. */
export const hasLocalKeyboardOwner = (document: Document) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [role="menu"][data-state="open"]',
    ),
  ].some((element) => element.getClientRects().length > 0);
/** Panel visibility remains global while dialogs and menus retain their other keys. */
export const availableKeyboardShortcuts = (document: Document, shortcuts: readonly WebviewKeyboardShortcut[]) =>
  hasLocalKeyboardOwner(document) ? shortcuts.filter((shortcut) => shortcut.entry === "panel") : shortcuts;
