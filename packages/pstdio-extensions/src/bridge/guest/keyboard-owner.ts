/** Dialogs and menus keep ownership of their keys before a host shortcut may enter. */
export const hasLocalKeyboardOwner = (document: Document) =>
  [
    ...document.querySelectorAll<HTMLElement>(
      'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [role="menu"][data-state="open"]',
    ),
  ].some((element) => element.getClientRects().length > 0);
