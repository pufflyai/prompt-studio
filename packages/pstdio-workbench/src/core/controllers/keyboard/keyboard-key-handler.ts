import { shortcutLayers } from "../../registries/keybindings/shortcut-preferences";
import type { InternalWorkbenchStore } from "../../shared/store/workbench-store";
import type { KeyboardActionChoice, KeyboardState } from "./keyboard-controller";
import type { ResolvedShortcut } from "./shortcut-catalog";
import { runShortcutMatches } from "./shortcut-matches";
import { matchShortcutPath } from "./shortcut-menu";

interface KeyboardKeyInput {
  controller: {
    finish(): void;
    back(): void;
    choose(key: string): Promise<void>;
    selectTab(number: number): Promise<void>;
  };
  store: InternalWorkbenchStore<KeyboardState>;
  catalog(fresh?: boolean): ResolvedShortcut[];
  select(title: string, choices: KeyboardActionChoice[]): void;
  run(shortcut: ResolvedShortcut): Promise<void>;
  message(text: string): void;
}

export const pressKeyboardKey = async (context: KeyboardKeyInput, input: string) => {
  const { controller, store, catalog, select, run, message } = context;
  if (!store.getState().active) return;
  if (input === "Escape") {
    controller.finish();
    return;
  }
  if (store.getState().selection) {
    if (input === "Backspace") controller.back();
    else await controller.choose(input);
    return;
  }
  if (input === "Enter") {
    controller.finish();
    return;
  }
  if (/^[1-9]$/.test(input)) {
    store.setState({ lastKey: input, message: "" });
    await controller.selectTab(Number(input));
    return;
  }
  if (input === "Backspace") {
    controller.back();
    return;
  }
  const key = input.toUpperCase();
  const path = [...store.getState().path, key];
  if (!store.getState().path.length && Object.values(shortcutLayers).some((candidate) => candidate === key)) {
    store.setState({ path, lastKey: undefined });
    return;
  }
  const matches = matchShortcutPath(catalog(true), path);
  if (matches.complete.length) {
    store.setState({ lastKey: key });
    await runShortcutMatches(matches.candidates, select, run);
    return;
  }
  if (matches.hasChildren) {
    store.setState({ path, lastKey: undefined });
    return;
  }
  message(`No shortcut for ${input}.`);
};
