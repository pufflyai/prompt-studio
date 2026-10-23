import { shortcutLayers } from "../../registries/keybindings/shortcut-preferences";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";
import { createKeyboardActionRunner } from "./keyboard-action-runner";
import { createKeyboardPreferences } from "./keyboard-preferences";
import {
  type KeyboardPresentation,
  type KeyboardTabStrips,
  listKeyboardTabs,
  visibleKeyboardTargets,
} from "./keyboard-presentations";
import { createShortcutCatalogReader } from "./shortcut-catalog-reader";
import { runShortcutMatches } from "./shortcut-matches";
import { matchShortcutPath, shortcutHints, shortcutMenuEntries } from "./shortcut-menu";

export interface KeyboardChoice {
  key: string;
  label: string;
  disabled?: boolean;
}
export interface KeyboardSelection {
  title: string;
  choices: KeyboardChoice[];
}
export interface KeyboardState {
  active: boolean;
  path: string[];
  selection?: KeyboardSelection;
  message: string;
  selectedId?: string;
  selectedRegion?: KeyboardPresentation["region"];
  restoreFocus: boolean;
}
export interface KeyboardActionChoice extends KeyboardChoice {
  choose(): void | Promise<void>;
}

export const createKeyboardController = (getCore: () => WorkbenchCore) => {
  const store = createWorkbenchStore<KeyboardState>({
    name: "workbench.keyboard",
    initialState: { active: false, path: [], message: "", restoreFocus: false },
  });
  const strips: KeyboardTabStrips = new Map();
  const visibility = new Map<string, () => readonly string[]>();
  let choices: KeyboardActionChoice[] = [];
  const stack: Array<{ title: string; choices: KeyboardActionChoice[] }> = [];
  const refresh = () => {
    catalogReader.invalidate();
    store.setState({ ...store.getState() });
  };
  const listTabs = () => listKeyboardTabs(getCore(), strips);
  const visibleTargets = () => {
    if (!visibility.size) return visibleKeyboardTargets(getCore());
    const ids = new Set([...visibility.values()].flatMap((read) => [...read()]));
    return visibleKeyboardTargets(getCore(), (id) => ids.has(id));
  };
  const catalogReader = createShortcutCatalogReader(getCore, visibleTargets);
  const catalog = (fresh = false) => catalogReader.read(fresh);
  let hintCatalog: ReturnType<typeof catalog> | undefined;
  let hintState: KeyboardState | undefined;
  let hintSnapshot = new Map<string, string>();
  const hints = () => {
    const currentCatalog = catalog();
    const currentState = store.getState();
    if (hintCatalog !== currentCatalog || hintState !== currentState) {
      hintSnapshot = shortcutHints(currentCatalog, currentState);
      hintCatalog = currentCatalog;
      hintState = currentState;
    }
    return hintSnapshot;
  };
  const presentations = () => [...listTabs(), ...visibleTargets()];
  const stop = (restore = true) => {
    choices = [];
    stack.length = 0;
    store.setState({ active: false, path: [], selection: undefined, restoreFocus: restore });
  };
  const message = (text: string) => store.setState({ message: text });
  const select = (title: string, next: KeyboardActionChoice[]) => {
    const previous = store.getState().selection;
    if (previous) stack.push({ title: previous.title, choices });
    choices = next;
    store.setState({
      active: true,
      selection: { title, choices: next.map(({ key, label, disabled }) => ({ key, label, disabled })) },
    });
  };
  const activate = (tab: KeyboardPresentation) => {
    const core = getCore();
    if (!presentations().some((current) => current.id === tab.id)) {
      message("This tab is no longer available.");
      return;
    }
    store.setState({ selection: undefined, selectedId: tab.id, selectedRegion: tab.region });
    core.layout.activateWidget(tab.id);
    choices = [];
    stack.length = 0;
    if (!store.getState().active) core.focus.setActiveRegion(tab.region);
    else refresh();
  };
  const run = createKeyboardActionRunner({
    getCore,
    store,
    catalog: () => catalog(true),
    stop,
    message,
    select,
    refresh,
    resetSelection: () => {
      choices = [];
      stack.length = 0;
      store.setState({ selection: undefined });
    },
  });
  const controller = {
    store: store as WorkbenchStore<KeyboardState>,
    refresh,
    listTabs,
    catalog,
    entries: () => shortcutMenuEntries(catalog(), store.getState().path),
    select,
    message,
    registerVisibleRegion(id: string, reader: () => readonly string[]) {
      visibility.set(id, reader);
      refresh();
      return createDisposable(() => {
        if (visibility.get(id) === reader) visibility.delete(id);
        refresh();
      });
    },
    registerTabStrip(
      region: KeyboardPresentation["region"],
      reader: () => import("./keyboard-presentations").KeyboardTabStrip,
    ) {
      strips.set(region, reader);
      refresh();
      return createDisposable(() => {
        if (strips.get(region) === reader) strips.delete(region);
        refresh();
      });
    },
    open() {
      catalogReader.invalidate();
      const core = getCore();
      const active =
        presentations().find((tab) => tab.id === core.layout.getLayout().activeWidgetId) ?? presentations()[0];
      choices = [];
      stack.length = 0;
      store.setState({
        active: true,
        path: [],
        selection: undefined,
        message: "",
        selectedId: active?.id,
        selectedRegion: active?.region,
        restoreFocus: false,
      });
    },
    close: stop,
    finish() {
      const core = getCore();
      const selected = presentations().find((tab) => tab.id === store.getState().selectedId);
      stop();
      if (selected) core.focus.setActiveRegion(selected.region);
    },
    async selectTab(number: number) {
      const tab = listTabs().find((tab) => tab.number === number);
      if (tab) activate(tab);
      else message(`Tab ${number} is not available.`);
    },
    selectPresentation(id: string, resourceId?: string) {
      const tab = presentations().find((tab) => tab.id === id && (!resourceId || tab.resource?.id === resourceId));
      if (tab) activate(tab);
      else {
        stop();
        message("This tab is no longer available.");
      }
    },
    nextTab(direction: number) {
      const tabs = listTabs();
      if (!tabs.length) return;
      const at = tabs.findIndex(
        (tab) => tab.id === (store.getState().selectedId ?? getCore().layout.getLayout().activeWidgetId),
      );
      activate(tabs[(at + direction + tabs.length) % tabs.length]!);
    },
    choose: async (key: string) => {
      const choice = choices.find((choice) => choice.key === key && !choice.disabled);
      await choice?.choose();
    },
    back() {
      const previous = stack.pop();
      if (previous) {
        choices = previous.choices;
        store.setState({
          selection: {
            title: previous.title,
            choices: choices.map(({ key, label, disabled }) => ({ key, label, disabled })),
          },
        });
      } else if (store.getState().selection) {
        choices = [];
        store.setState({ selection: undefined });
      } else store.setState({ path: store.getState().path.slice(0, -1) });
    },
    async press(input: string) {
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
      if (input === "ArrowLeft" || input === "ArrowRight") {
        const navigation = catalog(true).filter(
          (shortcut) =>
            !shortcut.disabled &&
            shortcut.binding.layer === "view" &&
            shortcut.keys.length === 2 &&
            shortcut.keys[1] === input.toUpperCase(),
        );
        if (navigation.length) await runShortcutMatches(navigation, select, run);
        return;
      }
      if (input === "Backspace") {
        controller.back();
        return;
      }
      const key = input.toUpperCase();
      const path = [...store.getState().path, key];
      if (!store.getState().path.length && Object.values(shortcutLayers).some((candidate) => candidate === key)) {
        store.setState({ path });
        return;
      }
      const matches = matchShortcutPath(catalog(true), path);
      if (matches.complete.length) {
        await runShortcutMatches(matches.candidates, select, run);
        return;
      }
      if (matches.hasChildren) {
        store.setState({ path });
        return;
      }
      message(`No shortcut for ${input}.`);
    },
    async invoke(id: string) {
      const shortcut = catalog(true).find((candidate) => candidate.id === id);
      if (shortcut && !shortcut.disabled) await run(shortcut);
    },
    ...createKeyboardPreferences(getCore, refresh),
    hints,
    hint(action: import("../../registries/navigation/navigation-registry").NavigationTarget) {
      return hints().get(getNavigationTargetKey(action));
    },
    visibleTargets,
  };
  return controller;
};
export type WorkbenchKeyboardController = ReturnType<typeof createKeyboardController>;
