import { type RefObject, useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import type { KeyboardState } from "../../core/controllers/keyboard/keyboard-controller";

const focusSelectedPresentation = (selected: Pick<KeyboardState, "selectedId" | "selectedRegion">) => {
  const instance = selected.selectedId
    ? document.querySelector<HTMLElement>(`[data-workbench-presentation="${CSS.escape(selected.selectedId)}"]`)
    : null;
  const region = selected.selectedRegion
    ? document.querySelector<HTMLElement>(`[data-workbench-region="${selected.selectedRegion}"]`)
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
  const focus =
    candidates
      .flatMap((selector) => [...(root?.querySelectorAll<HTMLElement>(selector) ?? [])])
      .find(
        (element) =>
          element.getClientRects().length &&
          getComputedStyle(element).visibility !== "hidden" &&
          !element.matches(':disabled,[type="hidden"]'),
      ) ?? root;
  focus?.focus({ preventScroll: true });
};

export const useKeyboardModeFocus = (
  workbench: WorkbenchCore,
  state: KeyboardState,
  content: RefObject<HTMLDivElement | null>,
  heading: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    if (!state.active && state.restoreFocus)
      focusSelectedPresentation({ selectedId: state.selectedId, selectedRegion: state.selectedRegion });
  }, [state.active, state.restoreFocus, state.selectedId, state.selectedRegion]);
  useEffect(() => {
    const activation = workbench.layout.onDidActivatePanel((panel) => {
      const current = workbench.keyboard.store.getState();
      if (!current.active || current.selection || current.selectedId === panel.instanceId) return;
      workbench.keyboard.selectPresentation(panel.instanceId);
      heading.current?.focus({ preventScroll: true });
    });
    return () => activation.dispose();
  }, [workbench, heading]);
  useEffect(() => {
    if (!state.active) return;
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
  }, [state.active, workbench, content, heading]);
};
