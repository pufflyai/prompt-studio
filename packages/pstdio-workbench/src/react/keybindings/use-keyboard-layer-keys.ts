import { type RefObject, useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { runUserAction } from "../../core/shared/run-user-action";

const ownsKeyboardEvent = (event: KeyboardEvent, content: HTMLElement | null, heading: HTMLElement | null) => {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.key === "Tab") return false;
  const target = event.target instanceof HTMLElement ? event.target : null;
  const inside = Boolean(target && content?.contains(target));
  if (!inside) return !target?.closest('[role="dialog"],[role="menu"]');
  if (target?.closest('input,textarea,[contenteditable="true"]'))
    return event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Escape";
  return event.key !== "Enter" || target === heading;
};
export const focusKeyboardChoice = (content: HTMLElement | null, key: string) => {
  const rows = [
    ...(content?.querySelectorAll<HTMLElement>(
      '[data-keyboard-choice]:not([aria-disabled="true"]):not(:disabled):not([disabled])',
    ) ?? []),
  ];
  const at = rows.indexOf(document.activeElement as HTMLElement);
  let next = at + (key === "ArrowDown" ? 1 : -1);
  if (at < 0) next = key === "ArrowDown" ? 0 : rows.length - 1;
  rows[(next + rows.length) % rows.length]?.focus();
};

export const useKeyboardLayerKeys = (input: {
  workbench: WorkbenchCore;
  content: RefObject<HTMLDivElement | null>;
  heading: RefObject<HTMLElement | null>;
  search(): void;
  browse(direction: string, choicesVisible: boolean): void;
}) => {
  const { workbench, content, heading, search, browse } = input;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!workbench.keyboard.store.getState().active || !ownsKeyboardEvent(event, content.current, heading.current))
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const choicesVisible = Boolean(content.current?.querySelector("[data-keyboard-choice]"));
        if (choicesVisible) focusKeyboardChoice(content.current, event.key);
        browse(event.key, choicesVisible);
        return;
      }
      if (event.key === "/") {
        search();
        return;
      }
      void runUserAction(workbench, "Keyboard shortcut", () => workbench.keyboard.press(event.key));
    };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [workbench, content, heading, search, browse]);
};
