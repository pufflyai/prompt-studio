import type { Page, TestInfo } from "@playwright/test";

// Keep the first failed focus handoff inspectable without forcing focus or changing scheduling.
export const recordTerminalFocus = (page: Page) =>
  page.addInitScript(() => {
    if (window.top !== window) return;
    const events: unknown[] = [];
    const identities = new WeakMap<Element, number>();
    let sequence = 0;
    const describe = (node: EventTarget | null) => {
      if (!(node instanceof Element)) return null;
      if (!identities.has(node)) identities.set(node, ++sequence);
      return {
        identity: identities.get(node),
        tag: node.tagName,
        id: node.id,
        role: node.getAttribute("role"),
        label: node.getAttribute("aria-label"),
        controls: node.getAttribute("aria-controls"),
        dataControls: node.getAttribute("data-controls"),
        connected: node.isConnected,
        instance: node.closest("[data-workbench-instance]")?.getAttribute("data-workbench-instance"),
        region: node.closest("[data-workbench-region]")?.getAttribute("data-workbench-region"),
      };
    };
    const record = (kind: string, target: EventTarget | null, stack?: string) => {
      events.push({
        at: performance.now(),
        kind,
        target: describe(target),
        active: describe(document.activeElement),
        stack,
      });
      if (events.length > 128) events.shift();
    };
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (options) {
      record("focus-call", this, new Error().stack?.split("\n").slice(1, 5).join("\n"));
      focus.call(this, options);
      record("focus-return", this);
    };
    document.addEventListener("focusin", (event) => record("focusin", event.target), true);
    document.addEventListener("focusout", (event) => record("focusout", event.target), true);
    const recordTerminals = (kind: string, nodes: NodeList) => {
      for (const node of nodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".xterm-helper-textarea")) record(kind, node);
        for (const terminal of node.querySelectorAll(".xterm-helper-textarea")) record(kind, terminal);
      }
    };
    new MutationObserver((records) => {
      for (const mutation of records) {
        recordTerminals("terminal-added", mutation.addedNodes);
        recordTerminals("terminal-removed", mutation.removedNodes);
      }
    }).observe(document, { subtree: true, childList: true });
    Reflect.set(window, "terminalFocusEvidence", events);
  });

export const attachTerminalFocus = async (page: Page, info: TestInfo) => {
  const evidence = await page.evaluate(() => ({
    events: Reflect.get(window, "terminalFocusEvidence"),
    active: document.activeElement?.outerHTML,
    terminals: [...document.querySelectorAll(".xterm-helper-textarea")].map((node) => ({
      html: node.outerHTML,
      visible: node.checkVisibility(),
      focused: node === document.activeElement,
    })),
  }));
  await info.attach("terminal-focus", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
};
