import { useUiScope } from "@pstdio/ui";
import { type RefObject, useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import type { KeyboardState } from "../../core/controllers/keyboard/keyboard-controller";

const focusSelectedPresentation = (
  selected: Pick<KeyboardState, "selectedId" | "selectedRegion">,
  surface: ParentNode,
) => {
  const instance = selected.selectedId
    ? surface.querySelector<HTMLElement>(`[data-workbench-presentation="${CSS.escape(selected.selectedId)}"]`)
    : null;
  const region = selected.selectedRegion
    ? surface.querySelector<HTMLElement>(`[data-workbench-region="${selected.selectedRegion}"]`)
    : null;
  const root = instance ?? region;
  const candidates = [
    '[contenteditable="true"]',
    "textarea",
    "input",
    "iframe",
    "[autofocus]",
    '[tabindex="0"]',
    "button",
  ];
  const focus = candidates
    .flatMap((selector) => [...(root?.querySelectorAll<HTMLElement>(selector) ?? [])])
    .find(
      (element) =>
        element.getClientRects().length &&
        getComputedStyle(element).visibility !== "hidden" &&
        !element.matches(':disabled,[type="hidden"]'),
    );
  const target = focus ?? root;
  target?.focus({ preventScroll: true });
  return Boolean(target && document.activeElement === target);
};

export const useKeyboardModeFocus = (
  workbench: WorkbenchCore,
  state: KeyboardState,
  content: RefObject<HTMLDivElement | null>,
  heading: RefObject<HTMLElement | null>,
) => {
  const scope = useUiScope();
  const active = scope?.active ?? true;
  const surface = scope?.root;
  useEffect(() => {
    if (!active || state.active || !state.restoreFocus || !state.selectedId) return;
    const selected = { selectedId: state.selectedId, selectedRegion: state.selectedRegion };
    const restore = () => {
      if (!focusSelectedPresentation(selected, surface?.current ?? document)) return false;
      workbench.keyboard.completeFocusRestore();
      return true;
    };
    if (restore()) return;
    // A tab header can be ready before its editor mounts. Keep the focus request until the view is ready.
    const observer = new MutationObserver(() => {
      const current = workbench.keyboard.store.getState();
      if (current.active || current.selectedId !== selected.selectedId || restore()) observer.disconnect();
    });
    const cancel = () => {
      observer.disconnect();
      workbench.keyboard.completeFocusRestore();
    };
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerdown", cancel, { once: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", cancel);
    };
  }, [state.active, state.restoreFocus, state.selectedId, state.selectedRegion, workbench, active, surface]);
  useEffect(() => {
    const activation = workbench.layout.onDidActivatePanel((panel) => {
      const current = workbench.keyboard.store.getState();
      if (
        !workbench.activation.isActive() ||
        !current.active ||
        current.selection ||
        current.selectedId === panel.instanceId
      )
        return;
      workbench.keyboard.selectPresentation(panel.instanceId);
      heading.current?.focus({ preventScroll: true });
    });
    return () => activation.dispose();
  }, [workbench, heading]);
  useEffect(() => {
    if (!active || !state.active) return;
    const pointer = (event: PointerEvent) => {
      if (content.current?.contains(event.target as Node)) return;
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))
        workbench.keyboard.close(false);
    };
    const focus = (event: FocusEvent) => {
      if (!workbench.keyboard.store.getState().active || content.current?.contains(event.target as Node)) return;
      if ((event.target as HTMLElement).closest('[role="dialog"],[role="menu"]')) return;
      heading.current?.focus({ preventScroll: true });
    };
    const blur = () => workbench.keyboard.close(false);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("focusin", focus);
    };
  }, [state.active, workbench, content, heading, active]);
};
