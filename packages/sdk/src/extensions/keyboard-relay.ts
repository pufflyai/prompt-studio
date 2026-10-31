import type { WebviewKeyboardShortcut, WebviewKeyboardShortcutRequest } from "pstdio-api-contracts/extension-kernel";

export interface WebviewKeyboardRelayHost {
  shortcuts(): readonly WebviewKeyboardShortcut[];
  dispatch(request: WebviewKeyboardShortcutRequest): void;
}

/** Runs both in managed guests and as a standalone prelude in opaque child frames. */
export const installWebviewKeyboardRelay = (host?: WebviewKeyboardRelayHost) => {
  let inherited: readonly WebviewKeyboardShortcut[] = [];
  let lastFocus: HTMLElement | null = null;
  const isEntry = (shortcut: WebviewKeyboardShortcut) =>
    shortcut.entry === "mode" || shortcut.entry === "tab" || shortcut.entry === "panel";
  const shortcuts = () => (host?.shortcuts() ?? inherited).filter(isEntry);
  const directFrame = (source: MessageEventSource | null) =>
    [...document.querySelectorAll("iframe")].find((frame) => frame.contentWindow === source);
  const sendProfile = (frame: HTMLIFrameElement) =>
    frame.contentWindow?.postMessage({ type: "pstdio.keyboard.profile", shortcuts: shortcuts() }, "*");
  const update = () => {
    for (const frame of document.querySelectorAll("iframe")) sendProfile(frame);
  };
  const dispatch = (request: WebviewKeyboardShortcutRequest) => {
    if (!shortcuts().some((shortcut) => shortcut.id === request.id)) return;
    const nested = { id: request.id, repeat: request.repeat === true, nested: true };
    if (host) host.dispatch(nested);
    else window.parent.postMessage({ type: "pstdio.keyboard.request", ...nested }, "*");
  };
  const restoreFocus = () => {
    const active = lastFocus?.isConnected ? lastFocus : document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    active.focus({ preventScroll: true });
    if (active instanceof HTMLIFrameElement)
      active.contentWindow?.postMessage({ type: "pstdio.keyboard.restore" }, "*");
  };
  const focus = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement) lastFocus = event.target;
  };
  const message = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (!host && event.source === window.parent) {
      if (data.type === "pstdio.keyboard.profile" && Array.isArray(data.shortcuts)) {
        inherited = data.shortcuts.filter(
          (shortcut: WebviewKeyboardShortcut) =>
            shortcut && typeof shortcut.id === "string" && typeof shortcut.key === "string" && isEntry(shortcut),
        );
        update();
      }
      if (data.type === "pstdio.keyboard.restore") restoreFocus();
      return;
    }
    const frame = directFrame(event.source);
    if (!frame) return;
    if (data.type === "pstdio.keyboard.ready") sendProfile(frame);
    if (data.type === "pstdio.keyboard.request" && document.activeElement === frame && typeof data.id === "string") {
      lastFocus = frame;
      dispatch({ id: data.id, repeat: data.repeat === true });
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (host || event.isComposing || event.repeat || event.getModifierState("AltGraph")) return;
    const editable = event
      .composedPath()
      .some(
        (target) =>
          target instanceof Element &&
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
          ),
      );
    if (editable && !event.altKey && !event.ctrlKey && !event.metaKey) return;
    const ownsKeys = [
      ...document.querySelectorAll<HTMLElement>(
        'dialog[open], [role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"], [role="menu"][data-state="open"]',
      ),
    ].some((element) => element.getClientRects().length > 0);
    const normalize = (key: string) => (key === " " ? "SPACE" : key.toUpperCase());
    const key =
      event.altKey && !/^[a-z]$/i.test(event.key) && /^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : event.key;
    const shortcut = shortcuts().find(
      (candidate) =>
        (!editable || candidate.allowInInputs !== false) &&
        (!ownsKeys || candidate.entry === "panel") &&
        (normalize(candidate.key) === normalize(key) ||
          (normalize(candidate.key) === "SPACE" && event.code === "Space") ||
          (/^[0-9]$/.test(candidate.key) && event.code === `Digit${candidate.key}`)) &&
        Boolean(candidate.ctrlKey) === event.ctrlKey &&
        Boolean(candidate.metaKey) === event.metaKey &&
        Boolean(candidate.altKey) === event.altKey &&
        Boolean(candidate.shiftKey) === event.shiftKey,
    );
    if (!shortcut) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (shortcut.entry === "mode" && document.activeElement instanceof HTMLElement) {
      lastFocus = document.activeElement;
      lastFocus.blur();
    }
    dispatch({ id: shortcut.id, repeat: false });
  };
  window.addEventListener("message", message);
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("focusin", focus);
  if (!host) window.parent.postMessage({ type: "pstdio.keyboard.ready" }, "*");
  return {
    update,
    restoreFocus,
    dispose() {
      window.removeEventListener("message", message);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focus);
      inherited = [];
    },
  };
};

/** Include in each preview frame; exposes keyboard entry only, never the extension host API. */
export const webviewKeyboardRelayDocument = `<script>(${installWebviewKeyboardRelay.toString()})()</script>`;
