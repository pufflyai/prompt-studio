import type { WorkbenchCoreContributionContext } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const emptyCatalog: ResolvedShortcut[] = [];
const emptyHints = new Map<string, string>();

export const useShortcutCatalog = (workbench: WorkbenchCoreContributionContext, enabled = true) => {
  "use no memo";
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) => (enabled ? state : undefined));
  useWorkbenchStore(workbench.keybindings.store, (state) => (enabled ? state.keybindings : undefined));
  useWorkbenchStore(workbench.commands.store, (state) => (enabled ? state.commands : undefined));
  useWorkbenchStore(workbench.context.store, (state) => (enabled ? state.values : undefined));
  useWorkbenchStore(workbench.layout.store, (state) => (enabled ? state.layout : undefined));
  const catalog = enabled ? workbench.keyboard.catalog() : emptyCatalog;
  return { state: keyboard, catalog, hints: enabled ? workbench.keyboard.hints() : emptyHints };
};
