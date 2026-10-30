import type { KeyboardState } from "../../core/controllers/keyboard/keyboard-controller";

/** Shortcut mode selects with the plain number; the preview shows the direct chord, which exists for 1 to 9. */
export const numberedTargetShortcut = (state: Pick<KeyboardState, "active" | "preview">, number?: number) => {
  if (number === undefined) return undefined;
  if (state.active) return String(number);
  if (state.preview && number <= 9) return `Alt+Shift+${number}`;
  return undefined;
};
