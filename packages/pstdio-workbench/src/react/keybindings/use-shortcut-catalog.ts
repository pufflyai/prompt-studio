import type { WorkbenchCoreContributionContext } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const emptyCatalog: ResolvedShortcut[] = [];
const emptyHints = new Map<string, string>();

export const useShortcutCatalog = (workbench: WorkbenchCoreContributionContext, enabled = true) => {
  "use no memo";
  const keyboard = useWorkbenchStore(workbench.keyboard.store, (state) => state);
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.store, (state) => state.layout);
  const catalog = enabled ? workbench.keyboard.catalog() : emptyCatalog;
  return { state: keyboard, catalog, hints: enabled ? workbench.keyboard.hints() : emptyHints };
};
