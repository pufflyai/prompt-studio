export const hasWorkbenchOverlayFocus = (element: HTMLElement) => {
  const overlays = document.querySelectorAll<HTMLElement>(
    '[role="menu"][data-state="open"],[role="dialog"][data-state="open"],[role="listbox"][data-state="open"]',
  );
  return [...overlays].some(
    (overlay) => !element.contains(overlay) && !overlay.contains(element) && overlay.getClientRects().length > 0,
  );
};
