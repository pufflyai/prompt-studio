import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

const terminalChunk = /\/assets\/terminal-engine-[^/]+\.js(?:\?.*)?$/;

type PanelMenuDiagnostic = Awaited<ReturnType<typeof startPanelMenuDiagnostic>>;

export const startPanelMenuDiagnostic = async (page: Page, info: TestInfo) => {
  if (!process.env.PANEL_MENU_DIAGNOSTIC) return;
  const early = process.env.PANEL_MENU_DIAGNOSTIC === "early-restored-focus";
  const gateTerminal = early || process.env.PANEL_MENU_DIAGNOSTIC === "terminal-gate";
  let terminalRequested = false;
  const gate = Promise.withResolvers<void>();
  await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const headerSelector = '[data-workbench-panel-header="side"], [data-workbench-panel-header="secondary"]';
    const ids = new WeakMap<Element, number>();
    let nextId = 0;
    const describe = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const existing = ids.get(target);
      const id = existing ?? ++nextId;
      if (!existing) ids.set(target, id);
      return {
        id,
        tag: target.tagName,
        label: target.getAttribute("aria-label"),
        role: target.getAttribute("role"),
        region: target.closest("[data-workbench-panel]")?.getAttribute("data-workbench-panel"),
        header: target.getAttribute("data-workbench-panel-header"),
        draggable: target.getAttribute("data-panel-draggable"),
        cls: target
          .getAttribute("class")
          ?.split(" ")
          .filter((name) => name.startsWith("xterm")),
        connected: target.isConnected,
      };
    };
    const events: object[] = [];
    const add = (kind: string, details: object) => {
      events.push({ at: performance.now(), kind, ...details, active: describe(document.activeElement) });
      if (events.length > 200) events.shift();
    };
    Reflect.set(window, "panelMenuEvidence", events);
    let previous = "";
    new MutationObserver(() => {
      const state = {
        headers: [...document.querySelectorAll(headerSelector)].map(describe),
        terminals: [...document.querySelectorAll(".xterm-helper-textarea")].map(describe),
        menus: [...document.querySelectorAll('[role="menu"]')].map(describe),
      };
      const key = JSON.stringify(state);
      if (key === previous) return;
      previous = key;
      add("dom", state);
    }).observe(document, {
      attributes: true,
      attributeFilter: ["data-panel-draggable", "id"],
      childList: true,
      subtree: true,
    });
    for (const type of ["focusin", "focusout", "keydown", "contextmenu"] as const) {
      document.addEventListener(
        type,
        (event) => {
          if (event instanceof KeyboardEvent && !["F10", "Escape", "ContextMenu"].includes(event.key)) return;
          const target = describe(event.target);
          const activeAtDispatch = describe(document.activeElement);
          queueMicrotask(() =>
            add(type, {
              target,
              activeAtDispatch,
              key: event instanceof KeyboardEvent ? event.key : undefined,
              shift: event instanceof KeyboardEvent ? event.shiftKey : undefined,
              prevented: event.defaultPrevented,
              trusted: event.isTrusted,
            }),
          );
        },
        true,
      );
    }
  });
  const documents: unknown[] = [];
  const record = async (stage: string) => {
    documents.push({
      stage,
      url: page.url(),
      events: await page.evaluate(() => Reflect.get(window, "panelMenuEvidence")),
    });
  };
  return {
    beforeReload: async () => {
      await record("before first panel restore");
      if (!gateTerminal) return;
      if (early)
        await page.addInitScript(() => {
          if (window !== window.top) return;
          const observer = new MutationObserver(() => {
            const tab = document.querySelector('[data-workbench-panel="main"] [role="tab"][aria-selected="true"]');
            const header = document.querySelector<HTMLElement>(
              '[data-workbench-panel-header="side"][data-panel-draggable="true"]',
            );
            if (!tab?.checkVisibility() || !header?.checkVisibility()) return;
            observer.disconnect();
            Reflect.set(window, "firstRestoredFocusAt", performance.now());
            header.focus();
          });
          observer.observe(document, {
            attributes: true,
            attributeFilter: ["data-panel-draggable", "aria-selected"],
            childList: true,
            subtree: true,
          });
        });
      await page.route(terminalChunk, async (route) => {
        terminalRequested = true;
        await gate.promise;
        await route.continue();
      });
    },
    beforeRestoredMenu: async (header: Locator, main: Locator, region: string) => {
      if (!gateTerminal || region !== "side") return false;
      if (early) expect(await page.evaluate(() => Reflect.get(window, "firstRestoredFocusAt"))).toBeGreaterThan(0);
      else await header.focus();
      await expect.poll(() => terminalRequested).toBe(true);
      await expect(header).toBeFocused();
      await record("side header focused with terminal engine blocked");
      gate.resolve();
      await expect(main.getByRole("textbox", { name: "Terminal input" })).toBeVisible();
      await record("terminal engine started after the header was focused");
      await expect(header).toBeFocused();
      return true;
    },
    record,
    finish: async () => {
      gate.resolve();
      const outcomes = await Promise.allSettled([
        page.context().tracing.stop({ path: info.outputPath("browser-context.zip") }),
        record("final browser state"),
      ]);
      for (const outcome of outcomes) {
        if (outcome.status === "rejected") console.error("Could not preserve panel menu evidence", outcome.reason);
      }
      await info.attach("panel-menu-focus", {
        body: JSON.stringify(documents, null, 2),
        contentType: "application/json",
      });
    },
  };
};

export type { PanelMenuDiagnostic };
