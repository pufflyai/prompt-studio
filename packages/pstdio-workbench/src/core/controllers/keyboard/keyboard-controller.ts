import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";
import { createKeyboardActionRunner } from "./keyboard-action-runner";
import { pressKeyboardKey } from "./keyboard-key-handler";
import { type KeyboardEmptyPanels, listKeyboardNumberedTargets } from "./keyboard-numbered-targets";
import { createKeyboardPreferences } from "./keyboard-preferences";
import { type KeyboardPresentation, type KeyboardTabStrips, visibleKeyboardTargets } from "./keyboard-presentations";
import { selectKeyboardTab } from "./keyboard-tab-selection";
import { createShortcutCatalogReader, createShortcutHintReader } from "./shortcut-catalog-reader";
import { shortcutMenuEntries } from "./shortcut-menu";

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
  lastKey?: string;
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
  const emptyPanels: KeyboardEmptyPanels = new Map();
  const visibility = new Map<string, () => readonly string[]>();
  let choices: KeyboardActionChoice[] = [];
  const stack: Array<{ title: string; choices: KeyboardActionChoice[] }> = [];
  const refresh = () => {
    catalogReader.invalidate();
    store.setState({ ...store.getState() });
  };
  const listNumberedTargets = () => listKeyboardNumberedTargets(getCore(), strips, emptyPanels);
  const listTabs = () =>
    listNumberedTargets().flatMap((target) =>
      target.kind === "tab" ? [{ ...target.tab, number: target.number }] : [],
    );
  const visibleTargets = () => {
    if (!visibility.size) return visibleKeyboardTargets(getCore());
    const ids = new Set([...visibility.values()].flatMap((read) => [...read()]));
    return visibleKeyboardTargets(getCore(), (id) => ids.has(id));
  };
  const catalogReader = createShortcutCatalogReader(getCore, visibleTargets);
  const catalog = (fresh = false) => catalogReader.read(fresh);
  const hints = createShortcutHintReader(catalog, store.getState);
  const presentations = () => [...listTabs(), ...visibleTargets()];
  const stop = (restore = true) => {
    choices = [];
    stack.length = 0;
    store.setState({ active: false, path: [], lastKey: undefined, selection: undefined, restoreFocus: restore });
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
    store.setState({ selection: undefined, selectedId: tab.id, selectedRegion: tab.region, restoreFocus: false });
    core.layout.activateWidget(tab.id);
    choices = [];
    stack.length = 0;
    if (!store.getState().active) {
      store.setState({ restoreFocus: true });
      core.focus.setActiveRegion(tab.region);
    } else refresh();
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
    listNumberedTargets,
    catalog,
    entries: () => shortcutMenuEntries(catalog(), store.getState().path),
    select,
    message,
    registerEmptyPanel(
      region: KeyboardPresentation["region"],
      reader: () => { top: number; left: number } | undefined,
    ) {
      emptyPanels.set(region, reader);
      refresh();
      return createDisposable(() => {
        if (emptyPanels.get(region) === reader) emptyPanels.delete(region);
        refresh();
      });
    },
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
        lastKey: undefined,
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
    selectTab: (number: number) => selectKeyboardTab(getCore(), number),
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
      const state = store.getState();
      const activeId = getCore().layout.getLayout().activeWidgetId;
      const selectedId = state.active ? (state.selectedId ?? activeId) : activeId;
      const at = tabs.findIndex((tab) => tab.id === selectedId);
      if (at === -1) {
        activate(direction > 0 ? tabs[0]! : tabs.at(-1)!);
        return;
      }
      activate(tabs[(at + direction + tabs.length) % tabs.length]!);
    },
    choose: async (key: string) => {
      const choice = choices.find((choice) => choice.key === key && !choice.disabled);
      await choice?.choose();
    },
    back() {
      store.setState({ lastKey: undefined });
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
    press: (input: string) => pressKeyboardKey({ controller, store, catalog, select, run, message }, input),
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
