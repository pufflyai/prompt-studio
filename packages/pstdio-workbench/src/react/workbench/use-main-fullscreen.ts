import { useEffect, useLayoutEffect, useRef } from "react";
import type { WorkbenchCore } from "../../core";
import { usePanelPolicy } from "../shared/use-panel-policy";
import { useWorkbenchStore } from "../shared/use-workbench-store";

export const useEffectiveSideMode = (workbench: WorkbenchCore) => {
  const active = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const normal = useWorkbenchStore(workbench.layout.store, () => workbench.sidePanel.getMode());
  const policy = usePanelPolicy(workbench, "side");
  if (!active) return normal;
  return policy.provided && policy.floatable && policy.open ? "floating" : "closed";
};

export const useMainFullscreen = (workbench: WorkbenchCore) => {
  const active = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  const sideMode = useEffectiveSideMode(workbench);
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef({ active, sideMode });
  useLayoutEffect(() => {
    const element = root.current;
    const before = previous.current;
    previous.current = { active, sideMode };
    if (!element) return;
    let target: HTMLElement | null = null;
    if (before.active && !active) {
      const entry = element.querySelector<HTMLElement>("[data-workbench-fullscreen-entry]");
      target = entry?.getClientRects().length ? entry : element.querySelector('[data-workbench-region="main"]');
    } else if (active && before.sideMode === "floating" && sideMode === "closed")
      target =
        element.querySelector("[data-workbench-fullscreen-side]") ??
        element.querySelector('[data-workbench-region="main"]');
    else if (
      !before.active &&
      active &&
      (element.ownerDocument.activeElement?.closest(
        '[data-workbench-region="activity"], [data-workbench-region="sidenav"], [data-workbench-region="secondary"], [data-workbench-region="status"]',
      ) ||
        element.ownerDocument.activeElement?.closest("[data-workbench-mode-nav]") ||
        (sideMode === "closed" && element.ownerDocument.activeElement?.closest('[data-workbench-panel="side"]')))
    )
      target = element.querySelector('[data-workbench-region="main"]');
    if (target) {
      workbench.focus.clearFocus();
      target.focus({ preventScroll: true });
    }
  }, [active, sideMode, workbench.focus]);
  useEffect(() => {
    if (!active) return;
    const window = root.current?.ownerDocument.defaultView;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || workbench.commandPalette.store.getState().open) return;
      const document = root.current?.ownerDocument;
      const nested = document?.querySelectorAll(
        '[role="menu"][data-state="open"], [role="listbox"][data-state="open"], [aria-modal="true"][data-state="open"]',
      );
      if (Array.from(nested ?? []).some((node) => node.getClientRects().length > 0)) return;
      workbench.fullscreen.exit();
    };
    window?.addEventListener("keydown", handleEscape);
    return () => window?.removeEventListener("keydown", handleEscape);
  }, [active, workbench]);
  return { active, root };
};
