export const movePanelHost = (host: HTMLElement, slot: HTMLElement | null | undefined) => {
  if (!slot || host.parentNode === slot) return;
  if (slot.moveBefore && host.isConnected && slot.isConnected) slot.moveBefore(host, null);
  // Temporary WebKit fallback: ADR 0053 explains the iframe reload limitation.
  else slot.appendChild(host);
};
